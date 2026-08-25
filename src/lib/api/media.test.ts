import { describe, expect, it } from "vitest";

import type { Post, PostSummary } from "./types";
import { mediaUrl, thumbnailUrl, thumbnailVariant, viewUrl, viewVariant } from "./media";

const summary = (over: Partial<PostSummary> = {}): PostSummary => ({
  id: "01J0",
  status: "active",
  tags: [],
  score: 0,
  favCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  md5: "abc123",
  derivatives: [
    { kind: "thumbnail", variant: "thumb.webp" },
    { kind: "sample", variant: "sample.webp" },
  ],
  ...over,
});

const post = (over: Partial<Post> = {}): Post => ({
  id: "01J0",
  status: "active",
  tags: [],
  score: 0,
  favorited: false,
  md5: "abc123",
  derivatives: [],
  ...over,
});

describe("mediaUrl", () => {
  it("builds <base>/media/<md5>/<variant>", () => {
    expect(mediaUrl("https://artemis.local", "abc123", "thumb.webp")).toBe(
      "https://artemis.local/media/abc123/thumb.webp",
    );
  });

  it("strips a trailing slash on the base", () => {
    expect(mediaUrl("https://artemis.local/", "abc123", "sample.webp")).toBe(
      "https://artemis.local/media/abc123/sample.webp",
    );
  });

  it("returns null in fixture mode (no base URL)", () => {
    expect(mediaUrl(null, "abc123", "thumb.webp")).toBeNull();
  });

  it("returns null when md5 or variant is missing", () => {
    expect(mediaUrl("https://artemis.local", undefined, "thumb.webp")).toBeNull();
    expect(mediaUrl("https://artemis.local", "abc123", undefined)).toBeNull();
  });
});

describe("thumbnailVariant / thumbnailUrl", () => {
  it("prefers the thumbnail derivative", () => {
    expect(thumbnailVariant(summary().derivatives)?.variant).toBe("thumb.webp");
    expect(thumbnailUrl("https://artemis.local", summary())).toBe(
      "https://artemis.local/media/abc123/thumb.webp",
    );
  });

  it("falls back to sample when there is no thumbnail", () => {
    const d = [{ kind: "sample", variant: "sample.webp" }];
    expect(thumbnailVariant(d)?.variant).toBe("sample.webp");
  });

  it("returns null (→ placeholder) when there are no derivatives", () => {
    expect(thumbnailVariant([])).toBeNull();
    expect(thumbnailUrl("https://artemis.local", summary({ derivatives: [] }))).toBeNull();
  });

  it("returns null in fixture mode even with a good ref", () => {
    expect(thumbnailUrl(null, summary())).toBeNull();
  });
});

describe("viewVariant / viewUrl", () => {
  it("picks the sample for an image", () => {
    const p = post({
      filetype: "png",
      derivatives: [
        { kind: "thumbnail", variant: "thumb.webp" },
        { kind: "sample", variant: "sample.webp" },
        { kind: "original", variant: "original.png" },
      ],
    });
    expect(viewVariant(p)?.variant).toBe("sample.webp");
    expect(viewUrl("https://artemis.local", p)).toBe(
      "https://artemis.local/media/abc123/sample.webp",
    );
  });

  it("picks the transcode for video (detected by duration)", () => {
    const p = post({
      duration: 12,
      derivatives: [
        { kind: "thumbnail", variant: "thumb.webp" },
        { kind: "transcode", variant: "720p.mp4" },
      ],
    });
    expect(viewVariant(p)?.variant).toBe("720p.mp4");
  });

  it("falls back to a video-looking variant when no transcode kind", () => {
    const p = post({
      filetype: "mp4",
      derivatives: [{ kind: "original", variant: "movie.mp4" }],
    });
    expect(viewVariant(p)?.variant).toBe("movie.mp4");
  });

  it("returns null when there is nothing usable", () => {
    expect(viewVariant(post({ derivatives: [] }))).toBeNull();
    expect(viewUrl("https://artemis.local", post({ derivatives: [] }))).toBeNull();
  });

  it("returns null for a video whose transcode is not ready (never an image still)", () => {
    // A video post that only has image derivatives so far must resolve to null (→ placeholder /
    // "processing"), NOT a sample.webp that would be rendered inside a <video> element.
    const p = post({
      duration: 30,
      derivatives: [
        { kind: "thumbnail", variant: "thumb.webp" },
        { kind: "sample", variant: "sample.webp" },
      ],
    });
    expect(viewVariant(p)).toBeNull();
    expect(viewUrl("https://artemis.local", p)).toBeNull();
  });
});
