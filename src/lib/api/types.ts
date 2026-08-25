/**
 * Types for the Artemis REST contract this console consumes. Backed by fixtures
 * until `NEXT_PUBLIC_ARTEMIS_BASE_URL` points at a live Artemis (see ./index).
 * All endpoints are unauthenticated; responses carry a server-minted
 * `X-Correlation-Id` the UI only reads (never sets).
 */

/** `GET /health` — liveness/readiness. `503` still returns this shape with status DOWN. */
export interface Health {
  status: "UP" | "DOWN";
  service: string;
  version: string;
}

/**
 * The health of the connection itself, as the UI sees it — distinguishes "Artemis
 * says DOWN" (a 503 body) from "I can't reach Artemis at all" (transport failure),
 * and from fixture mode (no live target configured).
 */
export type ConnectionState = "up" | "down" | "unreachable" | "fixtures";

/** One parsed Prometheus sample line. */
export interface MetricSample {
  /** Metric name (a `_bucket`/`_sum`/`_count` suffix is kept as-is). */
  name: string;
  /** Ordered label set as parsed (empty when the sample has no labels). */
  labels: Record<string, string>;
  /** Numeric value; `NaN`/`Infinity`/`-Infinity` are represented, never thrown. */
  value: number;
}

/** Per-metric metadata from `# HELP` / `# TYPE` lines. */
export interface MetricMeta {
  help?: string;
  type?: string;
}

/** The result of parsing a full `GET /metrics` exposition payload. */
export interface ParsedMetrics {
  samples: MetricSample[];
  meta: Record<string, MetricMeta>;
  /** Lines the parser could not read (surfaced for transparency, never fatal). */
  skipped: number;
}

/** Reprocess selection modes → the `select` string Artemis expects. */
export type ReprocessSelectMode = "one" | "stale" | "query";
export type ReprocessKind = "derivatives" | "metadata" | "tags";

export interface ReprocessRequest {
  /** `stale` | `id:<postId>` | a search-DSL query. */
  select: string;
  kind: ReprocessKind;
}

export interface ReprocessResult {
  enqueued: number;
}

/** An API error surfaced from a non-2xx `{ "error": "..." }` body. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
