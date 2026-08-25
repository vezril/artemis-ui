/**
 * Media-gateway URL helpers. Artemis streams Apollo derivatives from
 * `GET /media/{md5}/{variant}`; a URL is `<base>/media/<md5>/<variant>` where
 * `<base>` is the HTTP client's `baseUrl` (`NEXT_PUBLIC_ARTEMIS_BASE_URL`).
 *
 * In **fixture mode** there is no live media server, so `baseUrl` is `null` and
 * every builder returns `null` — the UI then renders a labelled placeholder
 * rather than emitting a broken `<img src>`. The variant-selection logic is the
 * same in both modes (and unit-tested), so URLs are correct the moment the app
 * points at a live service.
 */
import type { DerivativeRef, Post, PostSummary } from "./types";

/** Build a media-gateway URL, or `null` when any part is missing (e.g. fixtures). */
export function mediaUrl(
  baseUrl: string | null,
  md5: string | undefined,
  variant: string | undefined,
): string | null {
  if (!baseUrl || !md5 || !variant) return null;
  const root = baseUrl.replace(/\/$/, "");
  return `${root}/media/${encodeURIComponent(md5)}/${encodeURIComponent(variant)}`;
}

/** The best derivative to use as a thumbnail: `thumbnail`, else `sample`. */
export function thumbnailVariant(derivatives: DerivativeRef[]): DerivativeRef | null {
  return (
    derivatives.find((d) => d.kind === "thumbnail") ??
    derivatives.find((d) => d.kind === "sample") ??
    null
  );
}

const VIDEO_EXT = /\.(mp4|webm|mkv|mov)$/i;

/** The one canonical "is this post a video" check (duration or a video filetype). */
export function isVideoPost(post: Pick<Post, "filetype" | "duration">): boolean {
  if (post.duration != null) return true;
  const ft = post.filetype?.toLowerCase();
  return ft === "mp4" || ft === "webm" || ft === "mov" || ft === "mkv";
}

/** Whether a resolved derivative is a playable video (by kind or extension). */
export function isVideoVariant(d: DerivativeRef): boolean {
  return d.kind === "transcode" || VIDEO_EXT.test(d.variant);
}

/**
 * The best derivative to display in the post view. For images: `sample`, then
 * original / thumbnail. For video: ONLY an actual video derivative (a `transcode`
 * or a video-extension variant) — never an image still, so a `<video>` element is
 * never pointed at an image. Returns `null` (→ placeholder / "processing") when a
 * video post has no video derivative yet, or nothing usable exists.
 */
export function viewVariant(post: Pick<Post, "filetype" | "duration" | "derivatives">): DerivativeRef | null {
  const { derivatives } = post;
  if (isVideoPost(post)) {
    return derivatives.find((d) => d.kind === "transcode") ?? derivatives.find(isVideoVariant) ?? null;
  }
  const byKind = (kind: string) => derivatives.find((d) => d.kind === kind);
  return byKind("sample") ?? byKind("original") ?? byKind("thumbnail") ?? derivatives[0] ?? null;
}

/** A tile thumbnail URL, or `null` (→ placeholder) when there is no usable ref. */
export function thumbnailUrl(baseUrl: string | null, summary: PostSummary): string | null {
  const d = thumbnailVariant(summary.derivatives);
  return d ? mediaUrl(baseUrl, summary.md5, d.variant) : null;
}

/** A post-view media URL, or `null` (→ placeholder) when there is no usable ref. */
export function viewUrl(baseUrl: string | null, post: Post): string | null {
  const d = viewVariant(post);
  return d ? mediaUrl(baseUrl, post.md5, d.variant) : null;
}
