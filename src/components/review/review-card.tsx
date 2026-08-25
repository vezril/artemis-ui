"use client";

import * as React from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import type { ReviewItem } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { SuggestionChip } from "@/components/review/suggestion-chip";

/**
 * Reviews one post: its pre-checked suggestion chips (sorted by confidence
 * descending), an Accept button that applies the still-checked tags, and a
 * Reject-all button that applies nothing. Every suggestion starts checked — the
 * human unchecks the wrong ones. A failed resolve surfaces a per-card error and
 * the card comes back (the parent re-inserts it), so it can be retried.
 */
export function ReviewCard({
  item,
  categories,
  onAccept,
  onRejectAll,
  error,
  pending = false,
}: {
  item: ReviewItem;
  /** tag name → category number, resolved by the parent via `useTagCategories`. */
  categories: Record<string, number>;
  /** Called with the still-checked tag names. */
  onAccept: (tags: string[]) => void;
  /** Called for reject-all (applies nothing). */
  onRejectAll: () => void;
  /** A resolve error to surface (the card came back). */
  error?: string;
  /** A resolve is in flight for this card. */
  pending?: boolean;
}) {
  // Suggestions sorted by confidence (desc); a stable name tiebreak keeps the
  // order deterministic across renders.
  const sorted = React.useMemo(
    () =>
      [...item.suggestions].sort(
        (a, b) => b.confidence - a.confidence || a.tag.localeCompare(b.tag),
      ),
    [item.suggestions],
  );

  // Pre-checked: every suggestion starts accepted.
  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set(item.suggestions.map((s) => s.tag)),
  );

  function toggle(tag: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  // Accept only the still-checked tags, in the displayed (confidence) order.
  const acceptedTags = sorted.map((s) => s.tag).filter((t) => checked.has(t));

  return (
    <article className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          <Link href={`/posts/${item.postId}`} className="hover:underline">
            Post {item.postId}
          </Link>
        </h2>
        <span className="text-xs text-muted-foreground">
          {item.suggestions.length} suggestion{item.suggestions.length === 1 ? "" : "s"}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Pre-checked by confidence — uncheck the wrong ones, then accept.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {sorted.map((s) => (
          <SuggestionChip
            key={s.tag}
            suggestion={s}
            category={categories[s.tag] ?? 0}
            checked={checked.has(s.tag)}
            onToggle={() => toggle(s.tag)}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={() => onAccept(acceptedTags)} disabled={pending}>
          <Check className="size-4" aria-hidden />
          Accept
          {acceptedTags.length > 0 && (
            <span className="tabular-nums">({acceptedTags.length})</span>
          )}
        </Button>
        <Button variant="outline" onClick={onRejectAll} disabled={pending}>
          <X className="size-4" aria-hidden />
          Reject all
        </Button>
      </div>
    </article>
  );
}
