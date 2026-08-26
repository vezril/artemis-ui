"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { getClient } from "@/lib/api";
import type { SavedSearch } from "@/lib/api/types";

export const SAVED_SEARCHES_KEY = ["saved-searches"] as const;

/** The saved-search list (entity-backed, read-your-writes on the server). */
export function useSavedSearches() {
  return useQuery<SavedSearch[]>({
    queryKey: SAVED_SEARCHES_KEY,
    queryFn: () => getClient().listSavedSearches(),
    staleTime: 30_000,
  });
}

/** Snapshot context for optimistic list mutations. */
interface SavedSearchContext {
  previous: SavedSearch[] | undefined;
}

export interface SavedSearchMutations {
  /** `POST /saved-searches` — no optimistic insert; the list refetches on settle. */
  save: UseMutationResult<void, Error, { name: string; query: string }>;
  /** `PATCH` — optimistic rename with rollback. */
  rename: UseMutationResult<void, Error, { from: string; to: string }, SavedSearchContext>;
  /** `DELETE` — optimistic removal with rollback. */
  remove: UseMutationResult<void, Error, string, SavedSearchContext>;
}

/**
 * Saved-search writes. Rename/remove patch the cached list optimistically and
 * roll back on error; all three invalidate on settle. A shared mutation `scope`
 * serializes them (rapid rename→delete can't interleave); wire payloads are
 * single-name intents, so a queued replay after a rollback stays semantically
 * safe (no reorder-style whole-state staleness).
 */
export function useSavedSearchMutations(): SavedSearchMutations {
  const qc = useQueryClient();
  const scope = { id: "saved-search-mutation" };

  async function snapshot(): Promise<SavedSearchContext> {
    await qc.cancelQueries({ queryKey: SAVED_SEARCHES_KEY });
    return { previous: qc.getQueryData<SavedSearch[]>(SAVED_SEARCHES_KEY) };
  }
  function rollback(_e: unknown, _v: unknown, context: SavedSearchContext | undefined) {
    if (context?.previous) qc.setQueryData(SAVED_SEARCHES_KEY, context.previous);
  }
  function invalidate() {
    void qc.invalidateQueries({ queryKey: SAVED_SEARCHES_KEY });
  }

  const save = useMutation<void, Error, { name: string; query: string }>({
    scope,
    mutationFn: ({ name, query }) => getClient().saveSearch(name, query),
    onSettled: invalidate,
  });

  const rename = useMutation<void, Error, { from: string; to: string }, SavedSearchContext>({
    scope,
    mutationFn: ({ from, to }) => getClient().renameSavedSearch(from, to),
    async onMutate({ from, to }) {
      const ctx = await snapshot();
      qc.setQueryData<SavedSearch[]>(SAVED_SEARCHES_KEY, (prev) =>
        prev?.map((s) => (s.name === from ? { ...s, name: to } : s)),
      );
      return ctx;
    },
    onError: rollback,
    onSettled: invalidate,
  });

  const remove = useMutation<void, Error, string, SavedSearchContext>({
    scope,
    mutationFn: (name) => getClient().deleteSavedSearch(name),
    async onMutate(name) {
      const ctx = await snapshot();
      qc.setQueryData<SavedSearch[]>(SAVED_SEARCHES_KEY, (prev) =>
        prev?.filter((s) => s.name !== name),
      );
      return ctx;
    },
    onError: rollback,
    onSettled: invalidate,
  });

  return { save, rename, remove };
}
