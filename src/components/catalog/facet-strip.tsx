"use client";

import type { OrderKey } from "@/lib/api/types";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/categories";
import { addTerm, searchHref } from "@/lib/catalog/query";
import { useFacets } from "@/lib/hooks/use-catalog";
import { TagLink } from "@/components/catalog/tag-label";
import { cn } from "@/lib/utils";

/**
 * The "tags in these results" panel, from `GET /posts/facets?tags=<DSL>`. Tags
 * are grouped by category (shared colors + text labels); clicking one refines
 * the query by adding it as a term.
 */
export function FacetStrip({ tags, order }: { tags: string; order: OrderKey }) {
  const { data, isLoading } = useFacets(tags);

  if (isLoading) {
    return <p className="px-1.5 text-sm text-muted-foreground">Loading tags…</p>;
  }

  const groups = data?.facets ?? [];
  const byCategory = new Map(groups.map((g) => [g.category, g.tags]));
  const hasAny = groups.some((g) => g.tags.length > 0);

  if (!hasAny) {
    return <p className="px-1.5 text-sm text-muted-foreground">No tags to show yet.</p>;
  }

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((category) => {
        const list = byCategory.get(category);
        if (!list || list.length === 0) return null; // omit empty groups
        const meta = categoryMeta(category);
        return (
          <section key={category}>
            <h3
              className={cn(
                "mb-1 px-1.5 text-xs font-semibold uppercase tracking-wide",
                meta.text,
              )}
            >
              {meta.label}
            </h3>
            <ul>
              {list.map((tag) => (
                <li key={tag.name}>
                  <TagLink
                    name={tag.name}
                    category={category}
                    count={tag.count}
                    href={searchHref(addTerm(tags, tag.name), order)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
