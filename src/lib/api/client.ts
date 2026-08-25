import type {
  AutocompleteContext,
  Facets,
  Health,
  Post,
  PostPage,
  PostStatusResult,
  PurgeOutcome,
  ReprocessRequest,
  ReprocessResult,
  SearchQuery,
  Suggestion,
  SweepOutcome,
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

  /**
   * `GET /tags/autocomplete?q=&context=` — completions for the term under the
   * cursor. Tag context returns category-colored rows (snake_case on the wire);
   * metatag context returns a bare completion list. Both are normalized to
   * `Suggestion[]` so callers get one shape.
   */
  autocomplete(q: string, context: AutocompleteContext): Promise<Suggestion[]>;
}
