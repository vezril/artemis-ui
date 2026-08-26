import type {
  AutocompleteContext,
  Facets,
  Health,
  PoolDetail,
  PoolListPage,
  Post,
  PostPage,
  PostStatusResult,
  PurgeOutcome,
  Rating,
  ReprocessRequest,
  ReprocessResult,
  ReviewItem,
  SavedSearch,
  SearchQuery,
  SimilarPost,
  SimilarQuery,
  Suggestion,
  SweepOutcome,
  UploadResult,
} from "./types";

/**
 * The typed Artemis client interface the console depends on. Two implementations
 * exist — a fixtures-backed one (default) and an HTTP one against a live Artemis —
 * selected by `NEXT_PUBLIC_ARTEMIS_BASE_URL` in ./index. Views depend only on this
 * interface, never on a concrete implementation, so they behave identically against
 * fixtures and the real service.
 *
 * This first slice is operations-only (health / metrics / reprocess). Catalog
 * methods are added by later changes.
 */
export interface ArtemisClient {
  /** Whether this client talks to a live Artemis (`false` = fixtures). */
  readonly live: boolean;
  /** The configured base URL, or `null` in fixture mode. */
  readonly baseUrl: string | null;

  /** `GET /health`. Rejects only on a transport failure; a 503 resolves with `status: "DOWN"`. */
  getHealth(): Promise<Health>;

  /** `GET /metrics` — the raw Prometheus text exposition, parsed client-side by the caller. */
  getMetricsText(): Promise<string>;

  /** `POST /reprocess` → `{ enqueued }`. Throws `ApiError` on a 400 `{error}`. */
  reprocess(req: ReprocessRequest): Promise<ReprocessResult>;

  /**
   * Best-effort match-count preview for a reprocess selection, by running the same
   * DSL through `GET /posts` and reading how many come back on the first page.
   * Returns `null` when a count can't be determined (fixtures, or a non-DSL select).
   */
  previewSelectionCount(dsl: string): Promise<number | null>;

  // --- admin: deletion lifecycle (destructive; the UI gates purge/delete behind a confirm) ---

  /** `DELETE /posts/{id}` — soft-delete (hide, retain blobs). */
  deletePost(id: string): Promise<PostStatusResult>;

  /** `POST /posts/{id}/restore` — restore a soft-deleted post to active. */
  restorePost(id: string): Promise<PostStatusResult>;

  /** `POST /posts/{id}/purge` — permanently hard-purge a soft-deleted post. */
  purgePost(id: string): Promise<PurgeOutcome>;

  // --- admin: garbage collection ---

  /** `POST /admin/gc/orphan-sweep` — sweep failed-upload debris; `dryRun` reports without deleting. */
  orphanSweep(dryRun: boolean): Promise<SweepOutcome>;

  /** `POST /admin/gc/purge-deleted` — run one retention purge pass now → count purged. */
  purgeDeleted(): Promise<number>;

  // --- catalog: read surface -------------------------------------------------

  /**
   * `GET /posts?tags=&order=&cursor=&limit=` — keyset-paginated search. Pass the
   * returned `nextCursor` back as `cursor` for the next page, keeping `order`
   * fixed across the sequence. A `null`/absent `nextCursor` ends the list.
   */
  searchPosts(query: SearchQuery): Promise<PostPage>;

  /** `GET /posts/{id}` (string id). Throws `ApiError(404)` for a missing/purged post. */
  getPost(id: string): Promise<Post>;

  /** `GET /posts/facets?tags=` — the tags present in a result set, grouped by category. */
  facets(tags: string): Promise<Facets>;

  // --- catalog: similarity (Tier-1 near-duplicate search) --------------------
  //
  // Ranked by perceptual-hash Hamming distance, closest first. Both return ids +
  // distances only (never full posts), so callers hydrate matches via `getPost`.
  // A post with no phash yet (still processing) resolves to an empty list.

  /**
   * `GET /posts/{id}/similar?threshold=&limit=` — near-duplicates of an existing
   * post. Server defaults: threshold 10, limit 20 (both clamped server-side).
   */
  similarToPost(id: string, query?: SimilarQuery): Promise<SimilarPost[]>;

  /**
   * `GET /similar?phash=&threshold=&limit=` — reverse lookup from a supplied
   * perceptual hash (no post required). Same ranking and defaults.
   */
  similarToPhash(phash: string, query?: SimilarQuery): Promise<SimilarPost[]>;

  /**
   * `GET /tags/autocomplete?q=&context=` — completions for the term under the
   * cursor. Tag context returns category-colored rows (snake_case on the wire);
   * metatag context returns a bare completion list. Both are normalized to
   * `Suggestion[]` so callers get one shape.
   */
  autocomplete(q: string, context: AutocompleteContext): Promise<Suggestion[]>;

  // --- catalog: write surface (post editing) ---------------------------------
  //
  // All four are unauthenticated 200-with-no-body mutations. The console applies
  // them optimistically against the `["post", id]` query and reconciles by
  // re-reading `GET /posts/{id}` (read-your-writes on the entity).

  /**
   * `PATCH /posts/{id}/tags` with `{tags}` — a **full-set replace**. Callers send
   * the entire resulting tag set (not a diff). Throws `ApiError` on non-2xx.
   */
  patchTags(id: string, tags: string[]): Promise<void>;

  /**
   * `POST`/`DELETE /posts/{id}/favorite` — toggle by method (`favorite=true` →
   * POST, `false` → DELETE). Throws `ApiError` on non-2xx.
   */
  setFavorite(id: string, favorite: boolean): Promise<void>;

  /**
   * `POST /posts/{id}/score` with `{delta}` — Artemis scores by **delta** (a vote
   * of +1/-1), not an absolute set. Throws `ApiError` on non-2xx.
   */
  scorePost(id: string, delta: number): Promise<void>;

  /** `PATCH /posts/{id}/rating` with `{rating}` (g/s/q/e). Throws `ApiError` on non-2xx. */
  setRating(id: string, rating: Rating): Promise<void>;

  // --- catalog: upload -------------------------------------------------------

  /**
   * `POST /uploads?mediaType=<class>` — streams the file's bytes as the **raw
   * request body** (NOT multipart/form-data). The request `Content-Type` is the
   * file's MIME type and `mediaType` is derived from it (the top-level type, e.g.
   * `image`/`video`); an explicit `mediaType` overrides that derivation. Answers
   * `201 {postId, status:"pending"}`; a post's ingest status is then followed by
   * polling `getPost`. Throws `ApiError` on a 400 (empty body) / 502 (Apollo/Hermes
   * down) / other non-2xx `{error}`.
   */
  upload(file: File, mediaType?: string): Promise<UploadResult>;

  // --- catalog: review queue -------------------------------------------------
  //
  // Argus's tag suggestions are queued (never auto-applied); the human clears the
  // backlog by accepting the right suggestions per post or rejecting all. There is
  // no dedicated count endpoint — the needs-review count is the queue length.

  /**
   * `GET /review?limit=` → `{posts:[{postId, suggestions:[{tag, confidence,
   * source}]}]}`. Returns the backlog of posts awaiting review (the top-level
   * `posts` wrapper is unwrapped to `ReviewItem[]`). `limit` is optional (default
   * 50, clamped `0..200`).
   */
  getReviewQueue(limit?: number): Promise<ReviewItem[]>;

  /**
   * `POST /posts/{id}/review` with `{accept}` — resolve one post. A non-empty
   * `accept` applies exactly those tags; an **empty** `accept` (reject-all) applies
   * nothing and clears the review. Either way the post leaves the queue. 200 with
   * no body; throws `ApiError` on non-2xx.
   */
  reviewPost(id: string, accept: string[]): Promise<void>;

  // --- catalog: pools (ordered collections) ----------------------------------
  //
  // Browse reads are projection-backed and never 404 (unknown pool → empty page);
  // the entity read is read-your-writes and 404s when absent — it is the
  // authoritative member order the editor mutates against. Writes are 200-with-
  // no-body entity commands (`ApiError` on non-2xx; duplicate create is a 409).

  /** `GET /pools?cursor=&limit=` — keyset page of pool cards (covers hydrated). */
  listPools(cursor?: string | null): Promise<PoolListPage>;

  /** `GET /pools/{id}` — entity read: name + ordered member ids. 404 → `ApiError`. */
  getPool(id: string): Promise<PoolDetail>;

  /** `GET /pools/{id}/posts?cursor=&limit=` — hydrated members in pool order (never 404s). */
  poolPosts(id: string, cursor?: string | null): Promise<PostPage>;

  /** `POST /pools` with `{id, name}` — create. Duplicate id → `ApiError` 409. */
  createPool(id: string, name: string): Promise<void>;

  /** `PATCH /pools/{id}` with `{name}` — rename. */
  renamePool(id: string, name: string): Promise<void>;

  /** `DELETE /pools/{id}` — delete the pool (membership rows go with it). */
  deletePool(id: string): Promise<void>;

  /** `POST /pools/{id}/posts` with `{postId}` — append a member (idempotent). */
  addPoolPost(id: string, postId: string): Promise<void>;

  /** `DELETE /pools/{id}/posts/{postId}` — remove a member. */
  removePoolPost(id: string, postId: string): Promise<void>;

  /** `PUT /pools/{id}/order` with `{order}` — reorder; MUST be a full permutation. */
  reorderPool(id: string, order: string[]): Promise<void>;

  // --- catalog: saved searches -----------------------------------------------
  //
  // A single-user, entity-backed (read-your-writes) list of named DSL queries.
  // The UI RUNS a saved search by navigating the normal `/search?tags=` flow;
  // the server's `/saved-searches/{name}/results` endpoint is deliberately not
  // consumed here. Names go in path segments — always URL-encoded.

  /** `GET /saved-searches` — the ordered list (unwraps `{searches}`). */
  listSavedSearches(): Promise<SavedSearch[]>;

  /** `POST /saved-searches` with `{name, query}` — save. Invalid/duplicate → `ApiError`. */
  saveSearch(name: string, query: string): Promise<void>;

  /** `PATCH /saved-searches/{from}` with `{name: to}` — rename. */
  renameSavedSearch(from: string, to: string): Promise<void>;

  /** `DELETE /saved-searches/{name}` — remove. */
  deleteSavedSearch(name: string): Promise<void>;
}
