# Change: design-artemis-ui-pools

> **Design capture.** Pools — Danbooru-style **ordered collections** of posts (series, sets,
> comics) — as the fourth catalog write slice. Browse pools as cover cards, open one as an ordered
> gallery, create/rename/delete, add/remove members, and reorder. Backend shipped in Artemis v1.2.0
> (`design-artemis-pool-reads`) + the pre-existing pool write surface.

## Why

Pools are the most catalog-defining capability still missing: the way a series of related posts
(a comic, a photo set, variants of a shot) is kept together **in reading order**. Artemis has had
the full event-sourced pool write surface for months and v1.2.0 added the two reads a UI needs
(`GET /pools` with covers, `GET /pools/{id}/posts` hydrated in order) — deployed and verified live.
Nothing consumes any of it. This slice closes that loop and activates the nav's last "Soon" entry.

## What Changes

- A **Pools index** (`/pools`): keyset-paged grid of pool cards — cover thumbnail (from the API's
  hydrated `cover` summary), name, member count. A **New pool** dialog creates one (name; the id is
  a slug derived from the name, shown and editable; a 409 duplicate surfaces inline).
- A **Pool detail** view (`/pools/[id]`): the pool's name (inline rename), a **Delete pool**
  action (confirm dialog), and the members as an **ordered gallery** of post tiles — each linking
  to its post, removable, and **reorderable** (drag with pointer; move-left/move-right buttons for
  keyboard — never drag-only). Order changes commit as a full permutation (`PUT /pools/{id}/order`)
  optimistically with rollback.
- **Add to pool** from the post view: a "Pools" action on `/posts/[id]` that lists existing pools
  and appends the post (idempotent server-side). The pool detail also accepts a post id directly.
- `ArtemisClient` gains the pool surface: `listPools`, `getPool` (entity, read-your-writes id
  order), `poolPosts` (hydrated members), `createPool`, `renamePool`, `deletePool`, `addPoolPost`,
  `removePoolPost`, `reorderPool` — fixtures model a small pool set over the fixture posts.
- The "Pools" nav entry goes live (drops `comingSoon`).

## Capabilities

### New Capabilities
- `catalog-pools`: pools index with covers; ordered member gallery with remove + reorder
  (pointer AND keyboard); create/rename/delete; add-to-pool from the post view.

### Modified Capabilities
- (none — additive; app-shell activates its "Pools" nav entry.)

## Impact

- **Artemis API consumed** (all live in v1.2.0): `GET /pools?cursor=&limit=` →
  `{pools:[{id,name,postCount,cover}], nextCursor}`; `GET /pools/{id}/posts?cursor=&limit=` →
  `{posts:[PostSummary], nextCursor}` (never 404s; soft-deleted hidden); `GET /pools/{id}` →
  `{id,name,posts:[postId]}` (entity, 404 when absent — the authoritative order for the editor);
  writes: `POST /pools {id,name}` (409 duplicate), `POST /pools/{id}/posts {postId}` (idempotent),
  `DELETE /pools/{id}/posts/{postId}`, `PUT /pools/{id}/order {order}` (must be a permutation),
  `PATCH /pools/{id} {name}`, `DELETE /pools/{id}`.
- New routes `/pools` and `/pools/[id]`; components under `src/components/pools/`; hooks
  `use-pools.ts` with optimistic mutations on `["pools"]` / `["pool", id]` keys (TanStack, shared
  mutation `scope` per pool).
- Projection lag note: the hydrated members read is eventually consistent; the editor overlays
  optimistic cache updates and reconciles by invalidation (same pattern as every prior slice).

## Non-goals / out of scope

- `pool:` search metatag (Artemis-side, deferred), reverse lookup ("pools containing post X" —
  needs an Artemis route; the post-view "add to pool" action does NOT show current membership),
  pool descriptions/categories, nested pools, cover selection (cover is the first visible member),
  bulk add-from-search.
