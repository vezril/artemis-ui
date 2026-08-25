"use client";

import Link from "next/link";
import { Film } from "lucide-react";

import { getClient } from "@/lib/api";
import type { PostSummary } from "@/lib/api/types";
import { thumbnailUrl } from "@/lib/api/media";
import { formatDuration } from "@/lib/catalog/format";
import { MediaPlaceholder } from "@/components/catalog/media-placeholder";

/**
 * A single masonry tile. The thumbnail comes from the summary's media refs
 * (`<base>/media/<md5>/<variant>`, preferring the `thumbnail` derivative); a
 * summary without a usable ref renders a labelled placeholder rather than a
 * broken image. The whole tile links to the post view.
 */
export function PostTile({ post }: { post: PostSummary }) {
  const baseUrl = getClient().baseUrl;
  const thumb = thumbnailUrl(baseUrl, post);
  const isMotion = post.duration != null;
  const ratio = post.width && post.height ? `${post.width} / ${post.height}` : "1 / 1";

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group relative block overflow-hidden rounded-lg border border-border/50 bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ aspectRatio: ratio }}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- media is arbitrary remote (Apollo gateway) URLs, not Next-optimizable
        <img
          src={thumb}
          alt={`Post ${post.id}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
      ) : (
        <MediaPlaceholder label={post.md5 ?? post.id} />
      )}

      {isMotion && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
          <Film className="size-3" />
          {post.duration != null && <span>{formatDuration(post.duration)}</span>}
        </span>
      )}
    </Link>
  );
}
