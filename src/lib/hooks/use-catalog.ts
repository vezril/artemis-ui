"use client";

import * as React from "react";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";

import { getClient } from "@/lib/api";
import type { Facets, OrderKey, Post, PostPage, Suggestion, TagSuggestion } from "@/lib/api/types";
import { draftContext } from "@/lib/catalog/dsl";

export const POSTS_PAGE_LIMIT = 40;

export function postsQueryKey(tags: string, order: OrderKey) {
  return ["posts", tags, order] as const;
}

/**
 * Keyset (cursor) infinite scroll over the search results. Never OFFSET — the
 * server returns an opaque `nextCursor` that `getNextPageParam` feeds back as the
 * next page's `cursor`, with `order` held fixed across the sequence.
 */
export function useInfinitePosts(tags: string, order: OrderKey) {
  return useInfiniteQuery({
    queryKey: postsQueryKey(tags, order),
    queryFn: ({ pageParam }) =>
      getClient().searchPosts({ tags, order, limit: POSTS_PAGE_LIMIT, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: PostPage) => lastPage.nextCursor ?? undefined,
  });
}

/** Fetch a single post by (string) id. A 404 surfaces as `isError`. */
export function usePost(id: string) {
  return useQuery<Post>({
    queryKey: ["post", id],
    queryFn: () => getClient().getPost(id),
    retry: false,
  });
}

/** Tags-present-in-results facets for the current DSL query. */
export function useFacets(tags: string) {
  return useQuery<Facets>({
    queryKey: ["facets", tags],
    queryFn: () => getClient().facets(tags),
    staleTime: 30_000,
  });
}

/** Debounce a rapidly-changing value so we don't fire a query per keystroke. */
function useDebounced<T>(value: T, ms = 150): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Grammar-aware suggestions for the draft term under the cursor: tag context by
 * default, metatag context when the term contains a known `key:`.
 */
export function useAutocomplete(draft: string): Suggestion[] {
  const debounced = useDebounced(draft);
  const ctx = draftContext(debounced);

  const { data } = useQuery({
    queryKey: ["autocomplete", ctx.kind, ctx.query],
    queryFn: () => getClient().autocomplete(ctx.query, ctx.kind),
    enabled: ctx.query.length > 0,
    staleTime: 60_000,
  });

  return data ?? [];
}

/**
 * Resolve category numbers for committed tag names (posts carry only names, so
 * chips/sidebars look up the category via an exact autocomplete match). Each
 * lookup is cached ~forever — a tag's category rarely changes.
 *
 * KNOWN LIMITATION: this fans out one `/tags/autocomplete` request per tag
 * (react-query dedupes across renders, but a tag-heavy post still fires many),
 * and a tag not present in that query's (possibly popularity-truncated) results
 * falls back to category 0 (general) — so a rare tag can be mis-colored. A proper
 * fix is an Artemis batch tag-category endpoint; acceptable at single-user scale
 * with the general fallback until then.
 */
export function useTagCategories(names: string[]): Record<string, number> {
  const results = useQueries({
    queries: names.map((name) => ({
      queryKey: ["tag-category", name],
      queryFn: async (): Promise<number> => {
        const suggestions = await getClient().autocomplete(name, "tag");
        const exact = suggestions.find(
          (s): s is TagSuggestion => s.kind === "tag" && s.name === name,
        );
        return exact?.category ?? 0;
      },
      staleTime: Infinity,
    })),
  });

  const map: Record<string, number> = {};
  names.forEach((name, i) => {
    map[name] = results[i]?.data ?? 0;
  });
  return map;
}
