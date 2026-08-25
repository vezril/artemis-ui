import Link from "next/link";

import { categoryMeta } from "@/lib/categories";
import { formatCount } from "@/lib/catalog/format";
import { searchHref } from "@/lib/catalog/query";
import { cn } from "@/lib/utils";

/**
 * A single tag rendered with its category color. The color is ALWAYS paired with
 * the tag's text (and the category is exposed via `aria-label`), so category is
 * never conveyed by color alone.
 */
export function TagLabel({
  name,
  category,
  count,
  className,
}: {
  name: string;
  category: number;
  count?: number;
  className?: string;
}) {
  const meta = categoryMeta(category);
  const display = name.replace(/_/g, " ");
  return (
    <span
      className={cn("inline-flex items-baseline gap-1.5 text-sm", className)}
      aria-label={`${display} (${meta.label} tag${count != null ? `, ${count} posts` : ""})`}
    >
      <span aria-hidden className={cn("size-2 shrink-0 translate-y-[-1px] rounded-full", meta.bg)} />
      <span className={cn("truncate", meta.text)}>{display}</span>
      {count != null && (
        <span className="text-xs tabular-nums text-muted-foreground">{formatCount(count)}</span>
      )}
    </span>
  );
}

/** A clickable tag that refines the search by navigating to `/search?tags=<name>`. */
export function TagLink({
  name,
  category,
  count,
  href,
  className,
}: {
  name: string;
  category: number;
  count?: number;
  /** Override the destination (defaults to a fresh search for this tag). */
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href ?? searchHref(name)}
      className={cn("flex items-center rounded px-1.5 py-0.5 hover:bg-accent/60", className)}
    >
      <TagLabel name={name} category={category} count={count} />
    </Link>
  );
}
