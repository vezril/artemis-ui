"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { getClient } from "@/lib/api";
import type { Post, Rating } from "@/lib/api/types";

/** The `["post", id]` key `usePost` reads — mutations patch the SAME cache entry. */
function postKey(id: string) {
  return ["post", id] as const;
}

/** Context threaded from onMutate to onError so a failed write can roll back. */
interface RollbackContext {
  previous: Post | undefined;
}

/**
 * Optimistic write mutations for a single post, all keyed on the `["post", id]`
 * query that `usePost` reads. Each mutation:
 *  - `onMutate`: cancels in-flight fetches, snapshots the cached `Post`, and
 *    patches the cache immediately (optimistic);
 *  - `onError`: rolls the cache back to the snapshot (the error stays on the
 *    mutation object for the UI to surface);
 *  - `onSettled`: invalidates the post query so a real `GET /posts/{id}` reconciles
 *    the optimistic value (read-your-writes on the entity).
 *
 * Because the whole post view is subscribed to `["post", id]` via `usePost`, an
 * optimistic patch re-renders the sidebar and action bar without extra wiring.
 *
 * All four mutations share one TanStack `scope` (`post-mutation-<id>`), so they run
 * SEQUENTIALLY rather than concurrently — a rapid double-vote or an overlapping
 * favorite+tag-edit can't have an earlier write's rollback clobber a later write's
 * already-applied patch (each mutation's onMutate/onError/onSettled runs to
 * completion before the next starts, so every snapshot reflects the latest state).
 */
export interface PostMutations {
  editTags: UseMutationResult<void, Error, string[], RollbackContext>;
  toggleFavorite: UseMutationResult<void, Error, boolean, RollbackContext>;
  vote: UseMutationResult<void, Error, number, RollbackContext>;
  setRating: UseMutationResult<void, Error, Rating, RollbackContext>;
}

export function usePostMutations(id: string): PostMutations {
  const qc = useQueryClient();
  const key = postKey(id);

  /** Build an optimistic mutation from its request fn and a cache patch. */
  function optimistic<V>(
    mutationFn: (variables: V) => Promise<void>,
    patch: (prev: Post, variables: V) => Post,
  ) {
    return {
      mutationFn,
      // Serialize all of this post's writes so concurrent clicks can't interleave
      // their optimistic patches and stale rollbacks.
      scope: { id: `post-mutation-${id}` },
      async onMutate(variables: V): Promise<RollbackContext> {
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData<Post>(key);
        if (previous) qc.setQueryData<Post>(key, patch(previous, variables));
        return { previous };
      },
      onError(_err: Error, _variables: V, context: RollbackContext | undefined) {
        if (context) qc.setQueryData<Post>(key, context.previous);
      },
      onSettled() {
        void qc.invalidateQueries({ queryKey: key });
      },
    };
  }

  const editTags = useMutation(
    optimistic<string[]>(
      (tags) => getClient().patchTags(id, tags),
      (prev, tags) => ({ ...prev, tags: [...tags] }),
    ),
  );

  const toggleFavorite = useMutation(
    optimistic<boolean>(
      (favorite) => getClient().setFavorite(id, favorite),
      (prev, favorite) => ({ ...prev, favorited: favorite }),
    ),
  );

  const vote = useMutation(
    optimistic<number>(
      (delta) => getClient().scorePost(id, delta),
      (prev, delta) => ({ ...prev, score: prev.score + delta }),
    ),
  );

  const setRating = useMutation(
    optimistic<Rating>(
      (rating) => getClient().setRating(id, rating),
      (prev, rating) => ({ ...prev, rating }),
    ),
  );

  return { editTags, toggleFavorite, vote, setRating };
}
