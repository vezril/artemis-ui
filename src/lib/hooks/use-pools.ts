"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { getClient } from "@/lib/api";
import type { PoolDetail, PoolListPage, PostPage, PostSummary } from "@/lib/api/types";

/** Browse reads share the catalog's modest stale window (no refetch storms on nav). */
const POOLS_STALE_MS = 30_000;

export const POOLS_KEY = ["pools"] as const;
export const poolKey = (id: string) => ["pool", id] as const;
export const poolPostsKey = (id: string) => ["pool", id, "posts"] as const;

/** Keyset infinite scroll over the pools index (`GET /pools`). */
export function usePools() {
  return useInfiniteQuery({
    queryKey: POOLS_KEY,
    queryFn: ({ pageParam }) => getClient().listPools(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: PoolListPage) => lastPage.nextCursor ?? undefined,
    staleTime: POOLS_STALE_MS,
  });
}

/**
 * The ENTITY read (`GET /pools/{id}`): the pool's name and its authoritative
 * ordered member ids — read-your-writes, and the 404 signal for the not-found
 * state. The editor mutates against THIS order; the hydrated members read below
 * only supplies thumbnails.
 */
export function usePool(id: string) {
  return useQuery<PoolDetail>({
    queryKey: poolKey(id),
    queryFn: () => getClient().getPool(id),
    enabled: id.length > 0,
  });
}

/** Hydrated members in pool order (`GET /pools/{id}/posts`) — projection-backed. */
export function usePoolPosts(id: string) {
  return useInfiniteQuery({
    queryKey: poolPostsKey(id),
    queryFn: ({ pageParam }) => getClient().poolPosts(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: PostPage) => lastPage.nextCursor ?? undefined,
    staleTime: POOLS_STALE_MS,
    enabled: id.length > 0,
  });
}

/**
 * Join helper: hydrated summaries keyed by id. The gallery renders the ENTITY's
 * id order and looks each id up here — a member the projection hasn't caught up
 * with yet (`undefined`) renders as a placeholder tile rather than vanishing.
 */
export function memberMap(pages: PostPage[] | undefined): Map<string, PostSummary> {
  const map = new Map<string, PostSummary>();
  for (const page of pages ?? []) for (const p of page.posts) map.set(p.id, p);
  return map;
}

/** Context for optimistic pool-detail mutations: the entity snapshot to roll back to. */
interface PoolMutationContext {
  previous: PoolDetail | undefined;
}

export interface PoolMutations {
  /** `PUT /pools/{id}/order` — optimistic on the entity order; the full permutation. */
  reorder: UseMutationResult<void, Error, string[], PoolMutationContext>;
  /** `POST /pools/{id}/posts` — optimistic append (idempotent server-side). */
  addPost: UseMutationResult<void, Error, string, PoolMutationContext>;
  /** `DELETE /pools/{id}/posts/{postId}` — optimistic removal. */
  removePost: UseMutationResult<void, Error, string, PoolMutationContext>;
  /** `PATCH /pools/{id}` — optimistic rename. */
  rename: UseMutationResult<void, Error, string, PoolMutationContext>;
}

/**
 * The pool-detail write surface, all optimistic against the ENTITY cache
 * (`["pool", id]`) with rollback on error and invalidation on settle. Every
 * mutation shares one TanStack `scope`, so writes to the same pool run strictly
 * in sequence — a rapid move-move-remove can't interleave its permutations.
 * Membership/count changes also invalidate the index (`["pools"]`) and the
 * hydrated members read.
 */
export function usePoolMutations(id: string): PoolMutations {
  const qc = useQueryClient();
  const scope = { id: `pool-mutation-${id}` };

  async function snapshot(): Promise<PoolMutationContext> {
    await qc.cancelQueries({ queryKey: poolKey(id) });
    return { previous: qc.getQueryData<PoolDetail>(poolKey(id)) };
  }
  function rollback(_err: unknown, _vars: unknown, context: PoolMutationContext | undefined) {
    if (context?.previous) qc.setQueryData(poolKey(id), context.previous);
  }
  function patch(fn: (prev: PoolDetail) => PoolDetail) {
    qc.setQueryData<PoolDetail>(poolKey(id), (prev) => (prev ? fn(prev) : prev));
  }
  function settleMembership() {
    void qc.invalidateQueries({ queryKey: poolKey(id) });
    void qc.invalidateQueries({ queryKey: poolPostsKey(id) });
    void qc.invalidateQueries({ queryKey: POOLS_KEY });
  }

  const reorder = useMutation<void, Error, string[], PoolMutationContext>({
    scope,
    mutationFn: (order) => getClient().reorderPool(id, order),
    async onMutate(order) {
      const ctx = await snapshot();
      patch((prev) => ({ ...prev, posts: [...order] }));
      return ctx;
    },
    onError: rollback,
    onSettled() {
      void qc.invalidateQueries({ queryKey: poolKey(id) });
      void qc.invalidateQueries({ queryKey: poolPostsKey(id) });
    },
  });

  const addPost = useMutation<void, Error, string, PoolMutationContext>({
    scope,
    mutationFn: (postId) => getClient().addPoolPost(id, postId),
    async onMutate(postId) {
      const ctx = await snapshot();
      patch((prev) =>
        prev.posts.includes(postId) ? prev : { ...prev, posts: [...prev.posts, postId] },
      );
      return ctx;
    },
    onError: rollback,
    onSettled: settleMembership,
  });

  const removePost = useMutation<void, Error, string, PoolMutationContext>({
    scope,
    mutationFn: (postId) => getClient().removePoolPost(id, postId),
    async onMutate(postId) {
      const ctx = await snapshot();
      patch((prev) => ({ ...prev, posts: prev.posts.filter((p) => p !== postId) }));
      return ctx;
    },
    onError: rollback,
    onSettled: settleMembership,
  });

  const rename = useMutation<void, Error, string, PoolMutationContext>({
    scope,
    mutationFn: (name) => getClient().renamePool(id, name),
    async onMutate(name) {
      const ctx = await snapshot();
      patch((prev) => ({ ...prev, name }));
      return ctx;
    },
    onError: rollback,
    onSettled() {
      void qc.invalidateQueries({ queryKey: poolKey(id) });
      void qc.invalidateQueries({ queryKey: POOLS_KEY });
    },
  });

  return { reorder, addPost, removePost, rename };
}

/** `POST /pools` — create (no optimistic insert; the caller navigates/refreshes). */
export function useCreatePool() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; name: string }>({
    mutationFn: ({ id, name }) => getClient().createPool(id, name),
    onSettled() {
      void qc.invalidateQueries({ queryKey: POOLS_KEY });
    },
  });
}

/** `DELETE /pools/{id}` — delete (the caller navigates back to the index). */
export function useDeletePool(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    scope: { id: `pool-mutation-${id}` },
    mutationFn: () => getClient().deletePool(id),
    onSettled() {
      void qc.invalidateQueries({ queryKey: POOLS_KEY });
      qc.removeQueries({ queryKey: poolKey(id) });
      qc.removeQueries({ queryKey: poolPostsKey(id) });
    },
  });
}

/** Add a post to a pool from OUTSIDE the pool view (the post view's picker). */
export function useAddToPool() {
  const qc = useQueryClient();
  return useMutation<void, Error, { poolId: string; postId: string }>({
    mutationFn: ({ poolId, postId }) => getClient().addPoolPost(poolId, postId),
    onSettled(_data, _err, vars) {
      void qc.invalidateQueries({ queryKey: poolKey(vars.poolId) });
      void qc.invalidateQueries({ queryKey: poolPostsKey(vars.poolId) });
      void qc.invalidateQueries({ queryKey: POOLS_KEY });
    },
  });
}
