"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Star } from "lucide-react";

import type { Post, Rating } from "@/lib/api/types";
import { ApiError } from "@/lib/api/types";
import { RATING_LABELS } from "@/lib/catalog/dsl";
import { usePostMutations } from "@/lib/hooks/use-post-mutations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RATINGS: Rating[] = ["g", "s", "q", "e"];

/**
 * The always-interactive post action bar: favorite (a toggle star), score
 * (delta up/down around the current score), and rating (g/s/q/e). Every control
 * is optimistic — it mutates the `["post", id]` cache immediately (which
 * re-renders this bar from the patched `post`) and rolls back on failure.
 *
 * Accessibility: favorite is `aria-pressed`; score buttons carry labels; rating is
 * a `radiogroup` with roving tabindex + arrow-key selection (WAI-ARIA); a failed
 * action is announced via `role="alert"`, attributed to its control and cleared on
 * the next interaction.
 */
export function PostActions({ post }: { post: Post }) {
  const { toggleFavorite, vote, setRating } = usePostMutations(post.id);
  const [failed, setFailed] = React.useState<{ action: string; message: string } | null>(null);

  /** Clear any stale error, then run an optimistic action attributing its own failure. */
  function run(action: string, fn: (opts: { onError: (e: unknown) => void }) => void) {
    setFailed(null);
    fn({
      onError: (e) =>
        setFailed({ action, message: e instanceof ApiError ? e.message : "failed" }),
    });
  }

  const ratingRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = RATINGS.findIndex((r) => r === post.rating);

  function onRatingKeyDown(e: React.KeyboardEvent, index: number) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (dir === 0) return;
    e.preventDefault();
    const next = (index + dir + RATINGS.length) % RATINGS.length;
    ratingRefs.current[next]?.focus();
    run("Rating", (opts) => setRating.mutate(RATINGS[next], opts));
  }

  return (
    <section aria-label="Post actions" className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">Actions</h2>

      <div className="flex flex-wrap items-center gap-2">
        {/* Favorite */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={post.favorited}
          aria-label={post.favorited ? "Unfavorite" : "Favorite"}
          disabled={toggleFavorite.isPending}
          onClick={() =>
            run("Favorite", (opts) => toggleFavorite.mutate(!post.favorited, opts))
          }
          className={cn(post.favorited && "border-amber-500/50 text-amber-400")}
        >
          <Star className={cn("size-4", post.favorited && "fill-current")} />
          {post.favorited ? "Favorited" : "Favorite"}
        </Button>

        {/* Score (delta vote) */}
        <div className="inline-flex items-center rounded-md border border-border">
          <button
            type="button"
            aria-label="Downvote"
            disabled={vote.isPending}
            onClick={() => run("Score", (opts) => vote.mutate(-1, opts))}
            className="flex size-8 items-center justify-center rounded-l-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <ChevronDown className="size-4" />
          </button>
          <span
            className="min-w-10 px-1 text-center text-sm font-medium tabular-nums"
            aria-label={`Score ${post.score}`}
          >
            {post.score}
          </span>
          <button
            type="button"
            aria-label="Upvote"
            disabled={vote.isPending}
            onClick={() => run("Score", (opts) => vote.mutate(1, opts))}
            className="flex size-8 items-center justify-center rounded-r-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <ChevronUp className="size-4" />
          </button>
        </div>
      </div>

      {/* Rating — roving tabindex + arrow-key selection */}
      <div role="radiogroup" aria-label="Rating" className="inline-flex overflow-hidden rounded-md border border-border">
        {RATINGS.map((r, i) => {
          const checked = post.rating === r;
          // The checked option is the tab stop; if none is set, the first option is.
          const isTabStop = checkedIndex === -1 ? i === 0 : checked;
          return (
            <button
              key={r}
              ref={(el) => {
                ratingRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={RATING_LABELS[r] ?? r}
              tabIndex={isTabStop ? 0 : -1}
              disabled={setRating.isPending}
              onKeyDown={(e) => onRatingKeyDown(e, i)}
              onClick={() => run("Rating", (opts) => setRating.mutate(r, opts))}
              className={cn(
                "size-8 border-l border-border text-sm font-medium uppercase first:border-l-0 disabled:opacity-50",
                checked
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {r}
            </button>
          );
        })}
      </div>

      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {failed.action} failed: {failed.message}
        </p>
      )}
    </section>
  );
}
