# Tasks: design-artemis-ui-pools

## 1. API client

- [x] 1.1 Types: `PoolSummary {id, name, postCount, cover: PostSummary | null}`,
  `PoolListPage {pools, nextCursor}`, `PoolDetail {id, name, posts: string[]}` in
  `src/lib/api/types.ts`.
- [x] 1.2 `ArtemisClient` methods: `listPools(cursor?)`, `getPool(id)` (entity; `ApiError` 404),
  `poolPosts(id, cursor?)`, `createPool(id, name)`, `renamePool(id, name)`, `deletePool(id)`,
  `addPoolPost(id, postId)`, `removePoolPost(id, postId)`, `reorderPool(id, order)`.
- [x] 1.3 `http.ts` impls with the file's defensive parsing (missing envelope → safe default for
  the list reads; `expectOk` for writes; 409 surfaces its `{error}` message).
- [x] 1.4 `fixtures.ts`: 2 seeded pools (ordered multi-member + empty) over fixture posts; every
  method incl. keyset paging, covers, idempotent add, 409 duplicate create, permutation-validated
  reorder.
- [x] 1.5 Contract tests (`src/lib/api/pools.test.ts`): URL/param/body shapes, envelope tolerance,
  409 mapping, reorder body is the full permutation.

## 2. Hooks (`src/lib/hooks/use-pools.ts`)

- [x] 2.1 `usePools()` — infinite query on `["pools"]` (staleTime 30s).
- [x] 2.2 `usePool(id)` — entity read on `["pool", id]` (order + name + 404 signal);
  `usePoolPosts(id)` — infinite hydrated members on `["pool", id, "posts"]`; export a
  `memberMap` join helper (hydrated summaries keyed by id).
- [x] 2.3 Mutations with shared `scope: {id: "pool-mutation-" + id}`: `reorder`, `addPost`,
  `removePost`, `rename` (optimistic on `["pool", id]`, rollback onError, invalidate onSettled —
  membership/count changes also invalidate `["pools"]`); `createPool`, `deletePool` (invalidate
  `["pools"]`).
- [x] 2.4 Hook tests: optimistic reorder + rollback on error; add/remove optimistic entity-order
  updates; invalidation targets.

## 3. Pools index (`/pools`)

- [x] 3.1 `src/app/pools/page.tsx` + `src/components/pools/pools-view.tsx`: card grid (cover via
  `thumbnailVariant`/`mediaUrl`, placeholder when null; name; count), load-more on cursor,
  loading/error/empty states.
- [x] 3.2 `NewPoolDialog`: name input → derived editable slug id (kebab, `[a-z0-9-]`); submit →
  `createPool`; 409 inline on the id field; success closes + invalidates.
- [x] 3.3 Nav: drop `comingSoon` from the Pools entry.
- [x] 3.4 Component tests: cards render from fixtures; create flow incl. 409 path.

## 4. Pool detail (`/pools/[id]`)

- [x] 4.1 `src/app/pools/[id]/page.tsx` + `pool-view.tsx`: entity-driven order joined to hydrated
  summaries (placeholder tile when a member isn't hydrated yet); browse mode tiles link to posts;
  not-found (entity 404) and empty states; inline rename; Delete pool behind a confirm dialog →
  navigate to `/pools`.
- [x] 4.2 **Arrange mode** toggle: tiles stop navigating; per-tile remove (×), move-earlier /
  move-later buttons (aria-labeled, keyboard operable), and HTML drag-and-drop; every committed
  move/removal fires its optimistic mutation.
- [x] 4.3 Add-by-post-id field on the detail view (validated non-empty; idempotent add).
- [x] 4.4 Component tests: ordered render; keyboard move fires reorder with the full permutation;
  failed reorder rolls back with an attributed error; remove; not-found state.

## 5. Post-view integration

- [x] 5.1 `AddToPool` action on `/posts/[id]` (in PostActions or the sidebar): lists pools from
  `["pools"]`, choosing one calls `addPoolPost` (idempotent success feedback).
- [x] 5.2 Component test: picker lists fixture pools; choosing one calls the client with the
  post id.

## 6. Verification

- [x] 6.1 Full gate: lint, typecheck, vitest, `next build`.
- [x] 6.2 Frontend-review subagent pass; apply should-fixes.
- [x] 6.3 Browser smoke on fixtures: index cards → create pool → open detail → add members →
  arrange (drag + keyboard) → remove → rename → delete → not-found route.
- [x] 6.4 `openspec validate design-artemis-ui-pools --strict` clean.
