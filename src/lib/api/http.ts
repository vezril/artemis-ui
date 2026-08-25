import type { ArtemisClient } from "./client";
import {
  ApiError,
  type Health,
  type PostStatusResult,
  type PurgeOutcome,
  type ReprocessRequest,
  type ReprocessResult,
  type SweepOutcome,
} from "./types";

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
