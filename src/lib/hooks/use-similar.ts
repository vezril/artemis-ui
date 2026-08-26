"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { getClient } from "@/lib/api";
import type { Post, SimilarPost, SimilarQuery } from "@/lib/api/types";

/** One near-duplicate match hydrated into a full post (`post` is undefined while loading). */
export interface SimilarMatch extends SimilarPost {
  post?: Post;
}

export function similarQueryKey(id: string, query?: SimilarQuery) {
  return ["similar", id, query?.threshold ?? null, query?.limit ?? null] as const;
}

/**
 * Tier-1 near-duplicate search for one post, with each match hydrated into a full
 * post so the caller can render real thumbnails.
 *
 * Artemis returns ids + Hamming distances only (closest first), so this fans out a
 * `getPost` per match through the shared `["post", id]` cache — matches already
 * visited elsewhere in the console are free, and the post view's own read is reused.
 * Hydration failures (a purged post still in the index) degrade to a match without
 * a `post` rather than failing the whole list.
 *
 * `enabled: false` defers the request until the user actually asks for similars,
 * so opening a post never costs a similarity query.
 */
export function useSimilarPosts(id: string, query?: SimilarQuery, enabled = true) {
  const matches = useQuery<SimilarPost[]>({
    queryKey: similarQueryKey(id, query),
    queryFn: () => getClient().similarToPost(id, query),
    enabled: enabled && id.length > 0,
    staleTime: 60_000,
  });

  const hydrated = useQueries({
    queries: (matches.data ?? []).map((m) => ({
      queryKey: ["post", m.id],
      queryFn: () => getClient().getPost(m.id),
      staleTime: 60_000,
      retry: false,
    })),
  });

  const results: SimilarMatch[] = (matches.data ?? []).map((m, i) => ({
    ...m,
    post: hydrated[i]?.data,
  }));

  return {
    matches: results,
    isLoading: matches.isLoading,
    isError: matches.isError,
    error: matches.error,
    refetch: matches.refetch,
    /** True once the match list is in but thumbnails are still resolving. */
    isHydrating: !matches.isLoading && hydrated.some((h) => h.isLoading),
  };
}
