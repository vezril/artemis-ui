"use client";

import { getClient } from "@/lib/api";
import type { Post } from "@/lib/api/types";
import { isVideoVariant, mediaUrl, viewVariant } from "@/lib/api/media";
import { MediaPlaceholder } from "@/components/catalog/media-placeholder";

/**
 * The large media surface for the post view. The URL is built from the post's
 * media refs (a transcode for video, the sample/original for images); with no
 * usable ref (a pending post, or fixture mode) it falls back to a placeholder
 * rather than a broken element.
 */
export function MediaView({ post }: { post: Post }) {
  const baseUrl = getClient().baseUrl;
  // Resolve the variant once, then derive both the URL and the element type from it — so a
  // video post whose transcode isn't ready (variant is null → placeholder) is never rendered
  // in a <video>, and an image variant is never treated as video.
  const variant = viewVariant(post);
  const src = variant ? mediaUrl(baseUrl, post.md5, variant.variant) : null;
  const isVideo = variant != null && isVideoVariant(variant);

  if (!src) {
    const ratio = post.width && post.height ? `${post.width} / ${post.height}` : "4 / 3";
    return (
      <div
        className="mx-auto w-full max-w-2xl overflow-hidden rounded-lg"
        style={{ aspectRatio: ratio }}
      >
        <MediaPlaceholder label={post.md5 ?? post.id} />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="flex justify-center">
        <video
          controls
          loop
          playsInline
          src={src}
          className="max-h-[80vh] w-auto max-w-full rounded-lg bg-black"
        />
      </div>
    );
  }

  return (
    <div className="flex max-h-[80vh] items-center justify-center overflow-hidden rounded-lg bg-black/40">
      {/* eslint-disable-next-line @next/next/no-img-element -- media is arbitrary remote (Apollo gateway) URLs */}
      <img
        src={src}
        alt={`Post ${post.id}`}
        className="max-h-[80vh] w-auto max-w-full select-none"
      />
    </div>
  );
}
