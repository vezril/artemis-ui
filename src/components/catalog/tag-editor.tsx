"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import type { Post } from "@/lib/api/types";
import { usePostMutations } from "@/lib/hooks/use-post-mutations";
import { useTagCategories } from "@/lib/hooks/use-catalog";
import { SearchChip } from "@/components/catalog/search-chip";
import { TagInput } from "@/components/catalog/tag-input";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/types";

/**
 * The post tag editor. Seeds a local working set from the post's current tags,
 * shows them as removable chips (category-colored, reusing `SearchChip`) plus a
 * grammar-aware `TagInput` to add more, and on Save sends the **full resulting
 * set** via the optimistic `editTags` mutation (`PATCH /posts/{id}/tags`). Cancel
 * discards the working set. A save failure rolls the sidebar back and surfaces the
 * error inline; Save is disabled while the mutation is in flight.
 */
export function TagEditor({ post, onDone }: { post: Post; onDone: () => void }) {
  const { editTags } = usePostMutations(post.id);
  const [tags, setTags] = React.useState<string[]>(() => [...post.tags]);
  const categories = useTagCategories(tags);

  // If the post's tags change externally while the editor is open (a settle refetch),
  // adopt the new baseline ONLY when the user hasn't started editing — never clobber
  // in-progress edits. (The mutation serialization makes such mid-edit changes rare.)
  const baseline = React.useRef(post.tags);
  React.useEffect(() => {
    if (baseline.current === post.tags) return;
    setTags((cur) => {
      const clean =
        cur.length === baseline.current.length && cur.every((t, i) => t === baseline.current[i]);
      return clean ? [...post.tags] : cur;
    });
    baseline.current = post.tags;
  }, [post.tags]);

  function addTag(name: string) {
    setTags((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }

  function removeAt(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    editTags.mutate(tags, {
      onSuccess: () => onDone(),
    });
  }

  const dirty =
    tags.length !== post.tags.length || tags.some((t, i) => t !== post.tags[i]);
  const errorMessage =
    editTags.error instanceof ApiError
      ? editTags.error.message
      : editTags.error
        ? "Couldn’t save tags"
        : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Edit tags</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{tags.length}</span>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags — add some below.</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {tags.map((name, i) => (
            <li key={`${name}-${i}`}>
              <SearchChip
                term={name}
                category={categories[name]}
                onRemove={() => removeAt(i)}
              />
            </li>
          ))}
        </ul>
      )}

      <TagInput onAdd={addTag} disabled={editTags.isPending} />

      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={editTags.isPending || !dirty}>
          {editTags.isPending && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={editTags.isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
