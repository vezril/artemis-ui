import type { ArtemisClient } from "./client";
import {
  ApiError,
  type AutocompleteContext,
  type DerivativeRef,
  type Facets,
  type Health,
  type Post,
  type PostPage,
  type PostStatusResult,
  type PostSummary,
  type PurgeOutcome,
  type Rating,
  type ReprocessRequest,
  type ReprocessResult,
  type ReviewItem,
  type ReviewSuggestion,
  type SearchQuery,
  type SimilarPost,
  type SimilarQuery,
  type Suggestion,
  type SweepOutcome,
  type UploadResult,
} from "./types";

/**
 * Build the optional `?threshold=&limit=` tuning for a similarity request.
 * Unset values are omitted entirely so the server applies its own defaults
 * (threshold 10, limit 20) rather than us hard-coding them client-side.
 */
function similarParams(query?: SimilarQuery): string {
  const params = new URLSearchParams();
  if (query?.threshold != null) params.set("threshold", String(query.threshold));
  if (query?.limit != null) params.set("limit", String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Unwrap `{similar:[{id, distance}]}`, defensively. A missing or non-array envelope
 * yields an empty list rather than throwing (a post with no phash yet is a normal
 * state, not an error). Artemis returns matches closest-first and excludes the
 * target; both are re-enforced here as cheap client-side backstops (`selfId`
 * filter + a stable distance sort), matching this file's trust-nothing style.
 */
function parseSimilar(body: unknown, selfId?: string): SimilarPost[] {
  const rows = (body as { similar?: unknown })?.similar;
  if (!Array.isArray(rows)) return [];
  return rows
    .flatMap((r): SimilarPost[] => {
      const row = r as { id?: unknown; distance?: unknown };
      if (typeof row.id !== "string" || row.id === selfId) return [];
      return [{ id: row.id, distance: typeof row.distance === "number" ? row.distance : 0 }];
    })
    .sort((a, b) => a.distance - b.distance);
}

/**
 * The live Artemis HTTP client. Talks REST/JSON to the base URL from
 * `NEXT_PUBLIC_ARTEMIS_BASE_URL`. No auth (single-user Artemis); the server mints
 * `X-Correlation-Id` itself, so we never send one.
 *
 * Every response body is parsed defensively: Artemis (or a reverse proxy in front of
 * it) can return an empty body or an HTML error page, and a blind `JSON.parse` would
 * throw and be mis-read as a transport failure. Parse failures become a typed
 * `ApiError` (or, for health, a DOWN result) — never an uncaught throw.
 */
export function httpClient(baseUrl: string): ArtemisClient {
  const root = baseUrl.replace(/\/$/, "");
  const url = (path: string) => `${root}${path}`;

  /** Read a JSON body, turning a non-2xx or non-JSON body into an `ApiError`. */
  async function json<T>(res: Response): Promise<T> {
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      throw new ApiError(`non-JSON response (HTTP ${res.status})`, res.status);
    }
    if (!res.ok) {
      const message =
        body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${res.status}`;
      throw new ApiError(message, res.status);
    }
    return body as T;
  }

  /**
   * Assert a mutation succeeded. The write endpoints return 200 with **no body**,
   * so we never parse JSON on success; a non-2xx `{error}` body becomes an
   * `ApiError` (best-effort — an empty/HTML error body falls back to the status).
   */
  async function expectOk(res: Response): Promise<void> {
    if (res.ok) return;
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return {
    live: true,
    baseUrl: root,

    async getHealth(): Promise<Health> {
      // A 503 is a valid health answer (DOWN), not a transport error. Only a fetch
      // rejection (couldn't reach Artemis at all) rejects here; an empty/HTML/garbage
      // body is coerced from the status code so we never conflate "answered oddly"
      // with "unreachable".
      const res = await fetch(url("/health"), { cache: "no-store" });
      const text = await res.text();
      let raw: unknown;
      try {
        raw = text ? JSON.parse(text) : undefined;
      } catch {
        raw = undefined;
      }
      return coerceHealth(raw, res.ok);
    },

    async getMetricsText(): Promise<string> {
      const res = await fetch(url("/metrics"), { cache: "no-store" });
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
      return res.text();
    },

    async reprocess(req: ReprocessRequest): Promise<ReprocessResult> {
      const res = await fetch(url("/reprocess"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      const body = await json<unknown>(res);
      const enqueued = (body as { enqueued?: unknown } | undefined)?.enqueued;
      if (typeof enqueued !== "number" || !Number.isFinite(enqueued)) {
        throw new ApiError("unexpected /reprocess response (no enqueued count)", res.status);
      }
      return { enqueued };
    },

    async previewSelectionCount(dsl: string): Promise<number | null> {
      // Best-effort: page 1 of the same DSL. Artemis has no total-count endpoint, so this
      // reports "at least N on the first page" — the form treats it as a lower-bound hint.
      try {
        const params = new URLSearchParams({ tags: dsl, limit: "200" });
        const res = await fetch(url(`/posts?${params.toString()}`), { cache: "no-store" });
        if (!res.ok) return null;
        const body = (await res.json()) as { posts?: unknown[] };
        return Array.isArray(body.posts) ? body.posts.length : null;
      } catch {
        return null;
      }
    },

    async deletePost(id: string): Promise<PostStatusResult> {
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}`), { method: "DELETE" });
      return statusResult(await json<unknown>(res), res.status);
    },

    async restorePost(id: string): Promise<PostStatusResult> {
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}/restore`), { method: "POST" });
      return statusResult(await json<unknown>(res), res.status);
    },

    async purgePost(id: string): Promise<PurgeOutcome> {
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}/purge`), { method: "POST" });
      const o = (await json<unknown>(res)) as { purged?: unknown; blobsDeleted?: unknown };
      if (typeof o?.purged !== "boolean" || typeof o?.blobsDeleted !== "number") {
        throw new ApiError("unexpected /purge response", res.status);
      }
      return { purged: o.purged, blobsDeleted: o.blobsDeleted };
    },

    async orphanSweep(dryRun: boolean): Promise<SweepOutcome> {
      const res = await fetch(url("/admin/gc/orphan-sweep"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const o = (await json<unknown>(res)) as {
        scanned?: unknown;
        orphans?: unknown;
        deleted?: unknown;
      };
      if (![o?.scanned, o?.orphans, o?.deleted].every((v) => Number.isFinite(v))) {
        throw new ApiError("unexpected /orphan-sweep response", res.status);
      }
      return { scanned: o.scanned as number, orphans: o.orphans as number, deleted: o.deleted as number };
    },

    async purgeDeleted(): Promise<number> {
      const res = await fetch(url("/admin/gc/purge-deleted"), { method: "POST" });
      const o = (await json<unknown>(res)) as { purged?: unknown };
      if (typeof o?.purged !== "number") {
        throw new ApiError("unexpected /purge-deleted response", res.status);
      }
      return o.purged;
    },

    // --- catalog: read surface ---------------------------------------------

    async searchPosts(query: SearchQuery): Promise<PostPage> {
      const params = new URLSearchParams();
      if (query.tags.trim()) params.set("tags", query.tags.trim());
      if (query.order) params.set("order", query.order);
      if (query.cursor) params.set("cursor", query.cursor);
      params.set("limit", String(clampLimit(query.limit)));
      const res = await fetch(url(`/posts?${params.toString()}`), { cache: "no-store" });
      const body = await json<unknown>(res);
      const o = body as { posts?: unknown; nextCursor?: unknown };
      if (!Array.isArray(o?.posts)) {
        throw new ApiError("unexpected /posts response (no posts array)", res.status);
      }
      // A non-empty string is the only valid cursor; absent / null / "" all end the list
      // (an empty-string cursor would otherwise loop, re-fetching page 1 forever).
      const nextCursor =
        typeof o.nextCursor === "string" && o.nextCursor.length > 0 ? o.nextCursor : null;
      return { posts: o.posts.map(toSummary), nextCursor };
    },

    async getPost(id: string): Promise<Post> {
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}`), { cache: "no-store" });
      return toPost(await json<unknown>(res), res.status);
    },

    async facets(tags: string): Promise<Facets> {
      const params = new URLSearchParams();
      if (tags.trim()) params.set("tags", tags.trim());
      const res = await fetch(url(`/posts/facets?${params.toString()}`), { cache: "no-store" });
      const body = await json<unknown>(res);
      const groups = (body as { facets?: unknown })?.facets;
      if (!Array.isArray(groups)) {
        throw new ApiError("unexpected /posts/facets response", res.status);
      }
      return {
        facets: groups.map((g) => {
          const row = g as { category?: unknown; tags?: unknown };
          const tagList = Array.isArray(row.tags) ? row.tags : [];
          return {
            category: typeof row.category === "number" ? row.category : 0,
            tags: tagList.map((t) => {
              const tr = t as { name?: unknown; count?: unknown };
              return {
                name: typeof tr.name === "string" ? tr.name : "",
                count: typeof tr.count === "number" ? tr.count : 0,
              };
            }),
          };
        }),
      };
    },

    async similarToPost(id: string, query?: SimilarQuery): Promise<SimilarPost[]> {
      const qs = similarParams(query);
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}/similar${qs}`), {
        cache: "no-store",
      });
      return parseSimilar(await json<unknown>(res));
    },

    async similarToPhash(phash: string, query?: SimilarQuery): Promise<SimilarPost[]> {
      const params = new URLSearchParams({ phash });
      if (query?.threshold != null) params.set("threshold", String(query.threshold));
      if (query?.limit != null) params.set("limit", String(query.limit));
      const res = await fetch(url(`/similar?${params.toString()}`), { cache: "no-store" });
      return parseSimilar(await json<unknown>(res));
    },

    async autocomplete(q: string, context: AutocompleteContext): Promise<Suggestion[]> {
      const params = new URLSearchParams({ q, context });
      const res = await fetch(url(`/tags/autocomplete?${params.toString()}`), {
        cache: "no-store",
      });
      const body = await json<unknown>(res);
      if (!Array.isArray(body)) return [];
      if (context === "metatag") {
        // A bare string[] on the wire.
        return body
          .filter((v): v is string => typeof v === "string")
          .map((value) => ({ kind: "metatag", value, label: value }));
      }
      // Tag context: snake_case rows { name, category, post_count, alias_of? }.
      return body.map((row) => {
        const r = row as {
          name?: unknown;
          category?: unknown;
          post_count?: unknown;
          alias_of?: unknown;
        };
        return {
          kind: "tag",
          name: typeof r.name === "string" ? r.name : "",
          category: typeof r.category === "number" ? r.category : 0,
          postCount: typeof r.post_count === "number" ? r.post_count : 0,
          aliasOf: typeof r.alias_of === "string" ? r.alias_of : undefined,
        };
      });
    },

    // --- catalog: write surface --------------------------------------------

    async patchTags(id: string, tags: string[]): Promise<void> {
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}/tags`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      await expectOk(res);
    },

    async setFavorite(id: string, favorite: boolean): Promise<void> {
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}/favorite`), {
        method: favorite ? "POST" : "DELETE",
      });
      await expectOk(res);
    },

    async scorePost(id: string, delta: number): Promise<void> {
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}/score`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      await expectOk(res);
    },

    async setRating(id: string, rating: Rating): Promise<void> {
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}/rating`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      await expectOk(res);
    },

    // --- catalog: upload ---------------------------------------------------

    async upload(file: File, mediaType?: string): Promise<UploadResult> {
      // The file's bytes ARE the request body (raw, not multipart). Content-Type
      // carries the MIME type and `?mediaType=` its top-level class; both are
      // derived from the File unless an explicit mediaType overrides. A `File` is a
      // fully-sized Blob, so `fetch` sends it with a known length (no streaming/duplex).
      const cls = mediaType ?? deriveMediaType(file);
      const params = cls ? `?${new URLSearchParams({ mediaType: cls }).toString()}` : "";
      const res = await fetch(url(`/uploads${params}`), {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      const body = await json<unknown>(res);
      const o = (body ?? {}) as { postId?: unknown; status?: unknown };
      if (typeof o.postId !== "string" || typeof o.status !== "string") {
        throw new ApiError("unexpected /uploads response (no postId/status)", res.status);
      }
      return { postId: o.postId, status: o.status };
    },

    // --- catalog: review queue ---------------------------------------------

    async getReviewQueue(limit?: number): Promise<ReviewItem[]> {
      const params = new URLSearchParams({ limit: String(clampReviewLimit(limit)) });
      const res = await fetch(url(`/review?${params.toString()}`), { cache: "no-store" });
      const body = await json<unknown>(res);
      // The wire shape wraps the backlog in a top-level `posts` array.
      const posts = (body as { posts?: unknown })?.posts;
      if (!Array.isArray(posts)) {
        throw new ApiError("unexpected /review response (no posts array)", res.status);
      }
      return posts.map(toReviewItem).filter((item): item is ReviewItem => item !== null);
    },

    async reviewPost(id: string, accept: string[]): Promise<void> {
      // An empty (or absent) `accept` is reject-all; we always send the field for
      // an unambiguous, idempotent-replace body.
      const res = await fetch(url(`/posts/${encodeURIComponent(id)}/review`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      await expectOk(res);
    },
  };
}

/** Clamp the review page size into `[0, 200]` (default 50). */
function clampReviewLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 50;
  return Math.max(0, Math.min(200, Math.trunc(limit)));
}

/** Map a raw `/review` element into a `ReviewItem`, or `null` if it has no id. */
function toReviewItem(raw: unknown): ReviewItem | null {
  const o = (raw ?? {}) as { postId?: unknown; suggestions?: unknown };
  if (typeof o.postId !== "string" || o.postId === "") return null;
  const suggestions = Array.isArray(o.suggestions)
    ? o.suggestions
        .map((s): ReviewSuggestion | null => {
          const r = (s ?? {}) as { tag?: unknown; confidence?: unknown; source?: unknown };
          if (typeof r.tag !== "string" || r.tag === "") return null;
          return {
            tag: r.tag,
            confidence: num(r.confidence) ?? 0,
            source: str(r.source) ?? "",
          };
        })
        .filter((s): s is ReviewSuggestion => s !== null)
    : [];
  return { postId: o.postId, suggestions };
}

/**
 * Derive the `?mediaType=` class from a File's MIME type: the top-level segment
 * (`image`/`video`/…). An empty/typeless file yields `undefined` so the param is
 * omitted and Artemis sniffs the class itself.
 */
function deriveMediaType(file: File): string | undefined {
  const top = (file.type || "").split("/")[0];
  return top || undefined;
}

/** Clamp a page size into the `[1, 200]` range Artemis accepts (default 40). */
function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 40;
  return Math.max(1, Math.min(200, Math.trunc(limit)));
}

const RATINGS = new Set<Rating>(["g", "s", "q", "e"]);
function toRating(v: unknown): Rating | undefined {
  return typeof v === "string" && RATINGS.has(v as Rating) ? (v as Rating) : undefined;
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Normalize a `derivatives` array from a post body. */
function toDerivatives(v: unknown): DerivativeRef[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((d) => {
      const r = d as { kind?: unknown; variant?: unknown };
      return { kind: str(r.kind) ?? "", variant: str(r.variant) ?? "" };
    })
    .filter((d) => d.variant !== "");
}

/** Map a raw `/posts` element into a `PostSummary`, tolerating missing fields. */
function toSummary(raw: unknown): PostSummary {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(o.id) ?? "",
    status: str(o.status) ?? "active",
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : [],
    rating: toRating(o.rating),
    score: num(o.score) ?? 0,
    favCount: num(o.favCount) ?? 0,
    width: num(o.width),
    height: num(o.height),
    duration: num(o.duration),
    parent: str(o.parent),
    duplicateOf: str(o.duplicateOf),
    createdAt: str(o.createdAt) ?? "",
    md5: str(o.md5),
    derivatives: toDerivatives(o.derivatives),
  };
}

/** Validate + map a `/posts/{id}` body into a `Post`, or throw a typed error. */
function toPost(raw: unknown, status: number): Post {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (typeof o.id !== "string") {
    throw new ApiError("unexpected /posts/{id} response", status);
  }
  return {
    id: o.id,
    status: str(o.status) ?? "active",
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : [],
    rating: toRating(o.rating),
    score: num(o.score) ?? 0,
    favorited: o.favorited === true,
    parent: str(o.parent),
    source: str(o.source),
    md5: str(o.md5),
    filetype: str(o.filetype),
    width: num(o.width),
    height: num(o.height),
    duration: num(o.duration),
    derivatives: toDerivatives(o.derivatives),
  };
}

/** Validate a `{id, status}` admin-deletion response, or throw a typed error. */
function statusResult(body: unknown, status: number): PostStatusResult {
  const o = body as { id?: unknown; status?: unknown };
  if (typeof o?.id !== "string" || typeof o?.status !== "string") {
    throw new ApiError("unexpected response shape", status);
  }
  return { id: o.id, status: o.status };
}

/** Normalize an arbitrary /health body into a `Health`, deriving status from the code. */
function coerceHealth(raw: unknown, ok: boolean): Health {
  const o = (raw ?? {}) as Record<string, unknown>;
  const status: Health["status"] =
    o.status === "UP" || o.status === "DOWN" ? o.status : ok ? "UP" : "DOWN";
  return {
    status,
    service: typeof o.service === "string" ? o.service : "unknown",
    version: typeof o.version === "string" ? o.version : "unknown",
  };
}
