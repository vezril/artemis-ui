"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Copy, Loader2, SearchX } from "lucide-react";

import { getClient } from "@/lib/api";
import type { Post } from "@/lib/api/types";
import { mediaUrl, thumbnailVariant } from "@/lib/api/media";
import { type SimilarMatch, useSimilarPosts } from "@/lib/hooks/use-similar";
import { MediaPlaceholder } from "@/components/catalog/media-placeholder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * How a Hamming distance reads to a human. Hephaestus's phash + Artemis's default
 * `DEDUP_HAMMING_THRESHOLD` of 10 means "possible duplicate"; the bands below split
 * that range so a 0 (identical hash) is never shown the same as a borderline 9.
 */
function band(distance: number): { label: string; className: string } {
  if (distance === 0) return { label: "identical", className: "bg-primary/20 text-primary" };
  if (distance <= 4) return { label: "near-identical", className: "bg-primary/15 text-primary" };
  if (distance <= 8) return { label: "similar", className: "bg-accent text-accent-foreground" };
  return { label: "loose", className: "bg-muted text-muted-foreground" };
}

/**
 * Tier-1 "find similar" for a post: near-duplicates ranked by perceptual-hash
 * Hamming distance (Hephaestus computes the hash, Artemis ranks it).
 *
 * The query is **deferred** — it only fires once the user asks — so opening a post
 * never costs a similarity lookup. Each match is hydrated into a full post for its
 * thumbnail; a match whose post can't be read still renders (id + distance) rather
 * than vanishing.
 */
export function SimilarPosts({ post }: { post: Post }) {
  const [requested, setRequested] = React.useState(false);
  const { matches, isLoading, isError, error, isHydrating } = useSimilarPosts(
    post.id,
    undefined,
    requested,
  );

  return (
    <section aria-label="Similar posts" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Similar</h2>
        {requested && (isLoading || isHydrating) ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      {!requested ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setRequested(true)}>
          <Copy className="size-4" /> Find similar
        </Button>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">Searching for near-duplicates…</p>
      ) : isError ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5" />
            {(error as Error)?.message ?? "Similarity search failed."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setRequested(true)}>
            Retry
          </Button>
        </div>
      ) : matches.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <SearchX className="size-3.5" />
          No near-duplicates found.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-3 gap-1.5">
            {matches.map((m) => (
              <SimilarTile key={m.id} match={m} />
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Ranked by perceptual-hash distance, closest first.
          </p>
        </>
      )}
    </section>
  );
}

/** One match: thumbnail (when hydrated), linking to the post, badged with its distance. */
function SimilarTile({ match }: { match: SimilarMatch }) {
  const baseUrl = getClient().baseUrl;
  const post = match.post;
  const variant = post ? thumbnailVariant(post.derivatives) : null;
  const thumb = variant ? mediaUrl(baseUrl, post?.md5, variant.variant) : null;
  const { label, className } = band(match.distance);

  return (
    <li>
      <Link
        href={`/posts/${match.id}`}
        title={`Post ${match.id} — ${label} (distance ${match.distance})`}
        className="group relative block aspect-square overflow-hidden rounded-md border border-border/50 bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote media-gateway URLs
          <img
            src={thumb}
            alt={`Similar post ${match.id}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <MediaPlaceholder label={post?.md5 ?? match.id} />
        )}
        {/* Distance is text, never color-only. */}
        <span
          className={cn(
            "pointer-events-none absolute left-1 top-1 rounded px-1 py-0.5 text-[10px] font-medium tabular-nums",
            className,
          )}
        >
          {match.distance}
        </span>
      </Link>
    </li>
  );
}
