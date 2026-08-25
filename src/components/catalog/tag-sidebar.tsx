"use client";

import * as React from "react";
import { Pencil } from "lucide-react";

import type { Post } from "@/lib/api/types";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/categories";
import { useTagCategories } from "@/lib/hooks/use-catalog";
import { TagLink } from "@/components/catalog/tag-label";
import { TagEditor } from "@/components/catalog/tag-editor";

/**
 * The post view's tag sidebar. Posts carry only tag names, so categories are
 * resolved via autocomplete and the tags are grouped by category with the shared
 * colors (always paired with a text label). Each tag links to a search for it.
 *
 * An "Edit tags" affordance swaps the read-only list for the grammar-aware
 * `TagEditor`; edits save optimistically (the list re-renders from the patched
 * post query) and Cancel/Save returns to the read view.
 */
export function TagSidebar({ post }: { post: Post }) {
  const [editing, setEditing] = React.useState(false);
  const categories = useTagCategories(post.tags);

  if (editing) {
    return <TagEditor post={post} onDone={() => setEditing(false)} />;
  }

  // Group the names by resolved category number.
  const groups = new Map<number, string[]>();
  for (const name of post.tags) {
    const cat = categories[name] ?? 0;
    const list = groups.get(cat) ?? [];
    list.push(name);
    groups.set(cat, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Tags</h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          <Pencil className="size-3" /> Edit tags
        </button>
      </div>
      {post.tags.length === 0 ? (
        <p className="px-1.5 text-sm text-muted-foreground">No tags.</p>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const list = groups.get(category);
          if (!list || list.length === 0) return null;
          const meta = categoryMeta(category);
          return (
            <section key={category}>
              <h3
                className={`mb-1 px-1.5 text-xs font-semibold uppercase tracking-wide ${meta.text}`}
              >
                {meta.label}
              </h3>
              <ul>
                {[...list].sort((a, b) => a.localeCompare(b)).map((name) => (
                  <li key={name}>
                    <TagLink name={name} category={category} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
