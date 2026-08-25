"use client";

import { X } from "lucide-react";

import { parseTerm } from "@/lib/catalog/dsl";
import { categoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * A committed query term rendered as a removable chip. The four kinds are
 * visually distinct: plain tag (category dot + name), negated (`-tag`,
 * destructive tint + strike), OR (`~tag`, dashed), and metatag (`key:value`,
 * mono neutral).
 */
export function SearchChip({
  term,
  category,
  onRemove,
}: {
  term: string;
  /** Resolved category number for a plain/OR tag (undefined for metatags). */
  category?: number;
  onRemove: () => void;
}) {
  const parsed = parseTerm(term);
  const meta = category != null && !parsed.metatag ? categoryMeta(category) : null;

  const base =
    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs whitespace-nowrap";

  let body;
  let styles;
  if (parsed.metatag) {
    styles = "border-border bg-secondary text-secondary-foreground font-mono";
    body = <span>{parsed.value}</span>;
  } else if (parsed.negated) {
    styles =
      "border-destructive/50 bg-destructive/15 text-destructive line-through decoration-destructive/60";
    body = <span>&minus;{parsed.value.replace(/_/g, " ")}</span>;
  } else if (parsed.or) {
    styles = "border-dashed border-primary/60 bg-primary/10 text-foreground";
    body = (
      <>
        <span className="font-semibold text-primary" aria-label="or">
          ~
        </span>
        {meta && <span aria-hidden className={cn("size-1.5 rounded-full", meta.bg)} />}
        <span className={cn(meta?.text)}>{parsed.value.replace(/_/g, " ")}</span>
      </>
    );
  } else {
    styles = "border-border bg-card";
    body = (
      <>
        {meta && <span aria-hidden className={cn("size-1.5 rounded-full", meta.bg)} />}
        <span className={cn(meta?.text)}>{parsed.value.replace(/_/g, " ")}</span>
      </>
    );
  }

  const kindLabel = parsed.metatag
    ? "metatag"
    : parsed.negated
      ? "excluded tag"
      : parsed.or
        ? "optional (OR) tag"
        : "tag";

  return (
    <span className={cn(base, styles)} aria-label={`${parsed.value} (${kindLabel})`}>
      {body}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
        aria-label={`Remove ${parsed.value}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
