"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkPlus, Check, Pencil, X } from "lucide-react";

import type { SavedSearch } from "@/lib/api/types";
import { searchHref } from "@/lib/catalog/query";
import { useSavedSearches, useSavedSearchMutations } from "@/lib/hooks/use-saved-searches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The saved-searches panel on the search view: list (activate = run the query
 * through the normal `/search?tags=` flow — never a parallel results path),
 * inline rename, two-step inline delete, and saving the current query under a
 * name. All errors render inline, attributed to the row/form that caused them.
 */
export function SavedSearches() {
  const router = useRouter();
  const params = useSearchParams();
  const currentQuery = (params.get("tags") ?? "").trim();

  const list = useSavedSearches();
  const { save, rename, remove } = useSavedSearchMutations();

  const [saving, setSaving] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  // Per-row errors keyed by the row's name at mutate time, so two failing rows
  // can't overwrite each other and a stale error can't outlive its row's success.
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({});

  function run(query: string) {
    // Through the shared href builder (same encoding path as facet/tag links).
    router.push(searchHref(query));
  }

  function submitSave(e: React.FormEvent) {
    e.preventDefault();
    const name = saveName.trim();
    if (!name || !currentQuery) return;
    setSaveError(null);
    save.mutate(
      { name, query: currentQuery },
      {
        onSuccess: () => {
          setSaving(false);
          setSaveName("");
        },
        onError: (err) => setSaveError(err.message),
      },
    );
  }

  return (
    <section aria-label="Saved searches" className="mb-5">
      <h2 className="mb-2 flex items-center gap-1.5 px-1.5 text-sm font-semibold text-muted-foreground">
        <Bookmark className="size-3.5" aria-hidden /> Saved searches
      </h2>

      {list.isLoading ? (
        <div className="space-y-1.5 px-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-32" />
        </div>
      ) : list.isError ? (
        <p role="alert" className="px-1.5 text-xs text-destructive">
          Could not load saved searches.
        </p>
      ) : (list.data ?? []).length === 0 ? (
        <p className="px-1.5 text-xs text-muted-foreground">
          Nothing saved yet — run a search and save it here.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {(list.data ?? []).map((entry) => (
            <SavedSearchRow
              key={entry.name}
              entry={entry}
              error={rowErrors[entry.name]}
              onRun={() => run(entry.query)}
              onRename={(to) => {
                const from = entry.name;
                setRowErrors((prev) => without(prev, from));
                rename.mutate(
                  { from, to },
                  {
                    onSuccess: () => setRowErrors((prev) => without(prev, from)),
                    onError: (e) => setRowErrors((prev) => ({ ...prev, [from]: e.message })),
                  },
                );
              }}
              onDelete={() => {
                const name = entry.name;
                setRowErrors((prev) => without(prev, name));
                remove.mutate(name, {
                  onSuccess: () => setRowErrors((prev) => without(prev, name)),
                  onError: (e) => setRowErrors((prev) => ({ ...prev, [name]: e.message })),
                });
              }}
            />
          ))}
        </ul>
      )}

      <div className="mt-2 px-1.5">
        {saving ? (
          <form onSubmit={submitSave} className="space-y-1">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name this search…"
              aria-label="Saved search name"
              maxLength={128}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSaving(false);
                  setSaveName("");
                  setSaveError(null);
                }
              }}
              className="h-8 text-sm"
            />
            {saveError && (
              <p role="alert" className="text-xs text-destructive">
                {saveError}
              </p>
            )}
            <div className="flex gap-1.5">
              <Button type="submit" size="sm" disabled={!saveName.trim() || save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSaving(false);
                  setSaveName("");
                  setSaveError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!currentQuery}
            title={currentQuery ? undefined : "Run a search first"}
            onClick={() => setSaving(true)}
          >
            <BookmarkPlus className="size-4" aria-hidden /> Save current search
          </Button>
        )}
      </div>
    </section>
  );
}

/** One saved search row: run (name button), inline rename, two-step delete. */
function SavedSearchRow({
  entry,
  error,
  onRun,
  onRename,
  onDelete,
}: {
  entry: SavedSearch;
  error?: string;
  onRun: () => void;
  onRename: (to: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(entry.name);
  const [confirming, setConfirming] = React.useState(false);

  // Resync the draft when the (optimistic) name changes while not editing.
  React.useEffect(() => {
    if (!editing) setDraft(entry.name);
  }, [entry.name, editing]);

  if (editing) {
    return (
      <li className="px-1.5">
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const to = draft.trim();
            setEditing(false);
            if (to && to !== entry.name) onRename(to);
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`New name for ${entry.name}`}
            maxLength={128}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(entry.name);
                setEditing(false);
              }
            }}
            className="h-7 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            aria-label="Save name"
            disabled={!draft.trim()}
          >
            <Check className="size-3.5" aria-hidden />
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="group rounded-md px-1.5 py-0.5 hover:bg-accent/50">
      <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onRun}
        title={entry.query}
        className="min-w-0 flex-1 truncate text-left text-sm text-foreground/90 hover:text-foreground"
      >
        {entry.name}
      </button>
      {confirming ? (
        <span className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-6 px-1.5 text-xs"
            aria-label={`Confirm delete ${entry.name}`}
            onClick={onDelete}
          >
            Delete
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </span>
      ) : (
        <span className="flex shrink-0 items-center opacity-0 focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            aria-label={`Rename ${entry.name}`}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Delete ${entry.name}`}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setConfirming(true)}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

/** Return `record` without `key` (no-op copy when absent). */
function without(record: Record<string, string>, key: string): Record<string, string> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}
