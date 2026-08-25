"use client";

import { Check } from "lucide-react";

import type { ReviewSuggestion } from "@/lib/api/types";
import { categoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * A single AI tag suggestion rendered as a checkable chip: a checkbox box +
 * category color + tag name + confidence + source, pre-checked by default.
 * Clicking toggles acceptance.
 *
 * Accessibility: it's a real toggle (`role="checkbox"` + `aria-checked`) with a
 * visible checked state that is NOT color-only — a filled box with a check when
 * accepted, an empty dashed/struck-through chip when not — plus a descriptive
 * `aria-label` naming the tag, category, confidence, source, and state.
 */
export function SuggestionChip({
  suggestion,
  category,
  checked,
  onToggle,
}: {
  suggestion: ReviewSuggestion;
  /** Resolved category number (from `useTagCategories`). */
  category: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const meta = categoryMeta(category);
  const pct = Math.round(suggestion.confidence * 100);
  const display = suggestion.tag.replace(/_/g, " ");

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm transition-colors",
        checked
          ? "border-border bg-card"
          : "border-dashed border-border/60 bg-transparent opacity-60 line-through",
      )}
      aria-label={`${display} (${meta.label}, ${pct}% confidence, ${suggestion.source}), ${
        checked ? "accepted" : "rejected"
      }`}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-sm border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
        aria-hidden
      >
        {checked && <Check className="size-3" />}
      </span>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", meta.bg)} />
      <span className={cn("no-underline", meta.text)}>{display}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
      <span aria-hidden className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
        {suggestion.source}
      </span>
    </button>
  );
}
