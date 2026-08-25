"use client";

import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { getClient } from "@/lib/api";
import type { ReviewItem } from "@/lib/api/types";

/** The single query key the review queue and the nav badge both read. */
export const REVIEW_KEY = ["review"] as const;
/** A modest stale window (matches the catalog queries) so the app-wide badge and
 *  the view don't refetch on every focus / double-fetch on navigation. */
const REVIEW_STALE_MS = 30_000;

/** Variables for one resolve: the post and the tags to accept (empty ⇒ reject-all). */
export interface ResolveVars {
  postId: string;
  accept: string[];
}

/** Context threaded onMutate → onError so a failed resolve re-inserts the post. */
interface ResolveContext {
  /** The removed item, so it can be put back on failure. */
  item: ReviewItem | undefined;
  /** The postId that FOLLOWED it — a stable anchor to re-insert before, robust to the
   *  index drift that concurrent resolves cause (null ⇒ it was last → append). */
  nextPostId: string | null;
}

export interface ReviewQueue {
  /** The fetched queue (empty array while loading / on error). */
  items: ReviewItem[];
  /** Needs-review count = queue length (Artemis has no count endpoint). */
  count: number;
  /** The underlying query (loading / error state for the view). */
  query: UseQueryResult<ReviewItem[]>;
  /** Optimistic resolve: removes the post immediately, re-inserts on error. */
  resolve: UseMutationResult<void, Error, ResolveVars, ResolveContext>;
  /** Post ids with a resolve currently in flight (per-card pending, not just the last). */
  pendingIds: ReadonlySet<string>;
}

/**
 * The review queue plus its optimistic resolve mutation, both keyed on `["review"]`.
 *
 * `GET /review` seeds the list once; a resolve mutates the local `["review"]` cache
 * rather than re-fetching per post, so the reviewer's place isn't reshuffled:
 *
 *  - `onMutate`: cancels in-flight fetches, snapshots the item + its index, and
 *    removes it from the cached array immediately (optimistic auto-advance);
 *  - `onError`: re-inserts the item at its original index (or appends if the list
 *    changed under it) — the error itself is surfaced per-card by the view;
 *  - `onSettled`: invalidates `["review"]` so a real `GET /review` reconciles.
 *
 * The nav badge reads the same `["review"]` cache via `useReviewCount`, so a
 * resolve decrements it without extra wiring.
 */
export function useReviewQueue(): ReviewQueue {
  const qc = useQueryClient();
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(() => new Set());

  const query = useQuery<ReviewItem[]>({
    queryKey: REVIEW_KEY,
    queryFn: () => getClient().getReviewQueue(),
    staleTime: REVIEW_STALE_MS,
  });

  const resolve = useMutation<void, Error, ResolveVars, ResolveContext>({
    mutationFn: ({ postId, accept }) => getClient().reviewPost(postId, accept),
    async onMutate({ postId }): Promise<ResolveContext> {
      await qc.cancelQueries({ queryKey: REVIEW_KEY });
      setPendingIds((s) => new Set(s).add(postId));
      const previous = qc.getQueryData<ReviewItem[]>(REVIEW_KEY) ?? [];
      const index = previous.findIndex((i) => i.postId === postId);
      const item = index >= 0 ? previous[index] : undefined;
      const nextPostId =
        index >= 0 && index + 1 < previous.length ? previous[index + 1].postId : null;
      qc.setQueryData<ReviewItem[]>(
        REVIEW_KEY,
        previous.filter((i) => i.postId !== postId),
      );
      return { item, nextPostId };
    },
    onError(_err, _vars, context) {
      // Safe no-op when the item wasn't in the snapshot (e.g. a same-card double-click
      // whose first resolve already removed it) — there is nothing to restore.
      if (!context?.item) return;
      const item = context.item;
      qc.setQueryData<ReviewItem[]>(REVIEW_KEY, (current) => {
        const list = current ? [...current] : [];
        // Guard against a double re-insert (e.g. an invalidate raced in).
        if (list.some((i) => i.postId === item.postId)) return list;
        // Re-insert before the (still-present) neighbor rather than at a raw offset, so
        // concurrent resolves can't scramble order; append if the neighbor is gone too.
        // `onSettled`'s invalidate is the ultimate source of truth either way.
        const at = context.nextPostId
          ? list.findIndex((i) => i.postId === context.nextPostId)
          : -1;
        if (at >= 0) list.splice(at, 0, item);
        else list.push(item);
        return list;
      });
    },
    onSettled(_data, _err, vars) {
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(vars.postId);
        return next;
      });
      void qc.invalidateQueries({ queryKey: REVIEW_KEY });
    },
  });

  const items = query.data ?? [];
  return { items, count: items.length, query, resolve, pendingIds };
}

/**
 * Just the needs-review count, for the nav badge. Reads the same `["review"]`
 * cache as `useReviewQueue` (TanStack dedupes the fetch), so it's app-wide and
 * lightweight — the badge and the view never fire two queues.
 */
export function useReviewCount(): number {
  const { data } = useQuery<ReviewItem[], Error, number>({
    queryKey: REVIEW_KEY,
    queryFn: () => getClient().getReviewQueue(),
    staleTime: REVIEW_STALE_MS,
    select: (items) => items.length,
  });
  return data ?? 0;
}
