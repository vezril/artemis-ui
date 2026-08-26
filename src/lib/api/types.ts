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

/**
 * `DELETE /posts/{id}` and `POST /posts/{id}/restore` result. `status` is the known set with an
 * open escape hatch so a new Artemis status still type-checks (while the known ones narrow).
 */
export interface PostStatusResult {
  id: string;
  status: "active" | "deleted" | (string & {});
}

/** `POST /posts/{id}/purge` result. */
export interface PurgeOutcome {
  purged: boolean;
  blobsDeleted: number;
}

/** `POST /admin/gc/orphan-sweep` result (`deleted` is 0 on a dry-run). */
export interface SweepOutcome {
  scanned: number;
  orphans: number;
  deleted: number;
}

/**
 * `POST /uploads` result. Artemis answers `201 {postId, status:"pending"}` after
 * accepting the raw file bytes; the post then progresses `pending → active | failed`
 * asynchronously (followed via `GET /posts/{id}`). `status` keeps an open escape
 * hatch so an unknown server status still type-checks.
 */
export interface UploadResult {
  postId: string;
  status: "pending" | (string & {});
}

// --- catalog (read surface) -------------------------------------------------
//
// These types are reconciled to the REAL Artemis contract (Muses was written
// against a different assumed one): post ids are opaque **strings**; paging is
// **keyset** (an opaque `nextCursor`, never a page number); a post carries its
// `md5` plus `derivatives: [{kind, variant}]` from which media-gateway URLs are
// built (`<base>/media/<md5>/<variant>`); and autocomplete tag rows arrive
// **snake_case** (`post_count`, `alias_of`) while metatag context is a bare
// string array. Tag categories are **numbers** on the wire (0 general, 1 artist,
// 3 copyright, 4 character, 5 meta — see `@/lib/categories`).

/** Four-tier content rating: general / sensitive / questionable / explicit. */
export type Rating = "g" | "s" | "q" | "e";

/** One Apollo-derived media reference; the URL is `<base>/media/<md5>/<variant>`. */
export interface DerivativeRef {
  /** e.g. `thumbnail`, `sample`, `transcode`, `original`. */
  kind: string;
  /** The stored variant filename, e.g. `thumb.webp`, `sample.webp`, `720p.mp4`. */
  variant: string;
}

/** Lightweight post shape for gallery tiles (`GET /posts` → `posts[]`). */
export interface PostSummary {
  id: string;
  status: string;
  /** Bare tag names (categories are resolved separately via autocomplete/facets). */
  tags: string[];
  rating?: Rating;
  score: number;
  favCount: number;
  width?: number;
  height?: number;
  /** Seconds, for video/animated media. */
  duration?: number;
  parent?: string;
  duplicateOf?: string;
  createdAt: string;
  /** Media digest — the first path segment of a media-gateway URL. */
  md5?: string;
  /** Available Apollo derivatives (empty until processing completes). */
  derivatives: DerivativeRef[];
}

/** Full post detail for the post view (`GET /posts/{id}`). */
export interface Post {
  id: string;
  status: string;
  tags: string[];
  rating?: Rating;
  score: number;
  favorited: boolean;
  parent?: string;
  source?: string;
  md5?: string;
  filetype?: string;
  width?: number;
  height?: number;
  duration?: number;
  derivatives: DerivativeRef[];
}

/** A page of results — pass `nextCursor` back as `?cursor=` (keyset). `null` ends. */
export interface PostPage {
  posts: PostSummary[];
  nextCursor?: string | null;
}

/** DSL ordering options exposed by the search control. */
export type OrderKey = "id" | "score" | "favcount" | "duration" | "random";

export interface SearchQuery {
  /** The raw DSL string, e.g. `1girl cat_ears -monochrome ~solo`. */
  tags: string;
  order?: OrderKey;
  /** Opaque keyset cursor; kept stable-ordered across a sequence. */
  cursor?: string | null;
  /** Page size (default 40, clamped ≤ 200). */
  limit?: number;
}

/** One category's tags-in-results bucket (`GET /posts/facets`). */
export interface FacetGroup {
  /** Category number (0 general, 1 artist, 3 copyright, 4 character, 5 meta). */
  category: number;
  tags: { name: string; count: number }[];
}

export interface Facets {
  facets: FacetGroup[];
}

/** A tag suggestion (autocomplete in `tag` context; wire rows are snake_case). */
export interface TagSuggestion {
  kind: "tag";
  name: string;
  /** Category number (see `@/lib/categories`). */
  category: number;
  postCount: number;
  /** Present when `name` is an alias antecedent resolving to another tag. */
  aliasOf?: string;
}

/** A metatag suggestion (autocomplete in `metatag` context; wire is a bare string). */
export interface MetatagSuggestion {
  kind: "metatag";
  /** The full token to insert, e.g. `rating:s`. */
  value: string;
  label: string;
  description?: string;
}

export type Suggestion = TagSuggestion | MetatagSuggestion;

export type AutocompleteContext = "tag" | "metatag";

// --- catalog: review queue --------------------------------------------------
//
// Argus posts tag SUGGESTIONS to Artemis, which queues them for human review
// (suggestions are never auto-applied). A suggestion carries only a tag NAME (no
// category — that's resolved client-side via `useTagCategories`, the same
// autocomplete lookup the tag sidebar uses), plus a confidence and the source
// model that produced it.

/** One AI-suggested tag awaiting review (`GET /review` → `posts[].suggestions[]`). */
export interface ReviewSuggestion {
  /** The suggested tag name (bare; category resolved separately). */
  tag: string;
  /** Model confidence in `[0, 1]`. */
  confidence: number;
  /** The producing model, e.g. `wd-tagger`, `ram++`. */
  source: string;
}

/** One post awaiting review, with its suggestions (`GET /review` → `posts[]`). */
export interface ReviewItem {
  postId: string;
  suggestions: ReviewSuggestion[];
}

// --- similarity (Tier-1 near-duplicate search) ------------------------------
//
// Hephaestus computes a perceptual hash per media; Artemis stores it and ranks
// near-duplicates by Hamming distance. Both endpoints answer `{similar:[...]}`
// with matches **closest first** — ids and distances only, so the UI hydrates
// each match through the normal post read path.

/** One near-duplicate match: a post id and its perceptual-hash Hamming distance. */
export interface SimilarPost {
  id: string;
  /** Hamming distance from the target phash — lower is more similar (0 = identical hash). */
  distance: number;
}

/** Optional tuning for a similarity query (server defaults: threshold 10, limit 20). */
export interface SimilarQuery {
  /** Max Hamming distance to include. Server clamps; default 10. */
  threshold?: number;
  /** Max matches to return. Server clamps; default 20. */
  limit?: number;
}

// --- pools (ordered collections) --------------------------------------------
//
// Danbooru-style ordered collections of posts. Browse reads are projection-backed
// (Artemis v1.2.0): the list carries a hydrated cover summary per pool, and the
// members read returns full PostSummary rows in pool order — both keyset-paged.
// The entity read (`GET /pools/{id}`) is the read-your-writes ordered id list the
// editor mutates against.

/** One pool card (`GET /pools` → `pools[]`): id, name, visible member count, cover. */
export interface PoolSummary {
  id: string;
  name: string;
  /** Count over the VISIBLE (non-deleted) members — matches the gallery length. */
  postCount: number;
  /** The first visible member as a post summary, or null for an empty pool. */
  cover: PostSummary | null;
}

/** A keyset page of pools. */
export interface PoolListPage {
  pools: PoolSummary[];
  nextCursor?: string | null;
}

/** The entity read (`GET /pools/{id}`): name + the authoritative ordered member ids. */
export interface PoolDetail {
  id: string;
  name: string;
  posts: string[];
}

// --- saved searches ----------------------------------------------------------

/** One saved search: a user-chosen name for a stored DSL query. */
export interface SavedSearch {
  name: string;
  query: string;
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
