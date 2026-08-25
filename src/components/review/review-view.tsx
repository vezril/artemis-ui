"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";

import { useReviewQueue, type ResolveVars } from "@/lib/hooks/use-review";
import { useTagCategories } from "@/lib/hooks/use-catalog";
import { ReviewCard } from "@/components/review/review-card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Review view: the backlog of posts awaiting review, each as a card of
 * pre-checked suggestion chips. Accept applies the still-checked tags; Reject all
 * applies nothing. Resolving a post removes its card optimistically (auto-advance);
 * a failed resolve brings the card back with a per-card error. An empty queue shows
 * an all-caught-up state.
 */
export function ReviewView() {
  const { items, count, query, resolve, pendingIds } = useReviewQueue();

  // Resolve category numbers for every suggested tag in one pass (the chips are
  // colored by category, but suggestions carry only a name).
  const tagNames = React.useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.suggestions.map((s) => s.tag)))),
    [items],
  );
  const categories = useTagCategories(tagNames);

  // Per-post resolve errors, keyed by postId so an error survives the card's
  // optimistic removal + re-insertion.
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function runResolve(vars: ResolveVars) {
    setErrors((prev) => {
      if (!prev[vars.postId]) return prev;
      const next = { ...prev };
      delete next[vars.postId];
      return next;
    });
    resolve.mutate(vars, {
      onError: (err) =>
        setErrors((prev) => ({
          ...prev,
          [vars.postId]: err instanceof Error ? err.message : "Failed to resolve — try again.",
        })),
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
        {count > 0 && (
          <span className="text-sm text-muted-foreground">{count} awaiting review</span>
        )}
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-9 w-56" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load the review queue. {query.error?.message}
        </p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center text-muted-foreground">
          <CheckCircle2 className="size-8 text-category-character" aria-hidden />
          <p className="font-medium text-foreground">All caught up</p>
          <p className="text-sm">Nothing is waiting for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ReviewCard
              // Key by id only so a re-inserted card remounts fresh (all-checked).
              key={item.postId}
              item={item}
              categories={categories}
              onAccept={(tags) => runResolve({ postId: item.postId, accept: tags })}
              onRejectAll={() => runResolve({ postId: item.postId, accept: [] })}
              error={errors[item.postId]}
              pending={pendingIds.has(item.postId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
