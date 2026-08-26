# Design: design-artemis-ui-pools

## Context

The backend is complete and deployed (Artemis v1.2.0): projection-backed browse reads
(`GET /pools` with covers, `GET /pools/{id}/posts` hydrated in pool order, both keyset-paged,
never-404), an entity-backed read-your-writes `GET /pools/{id}` (bare ordered id list, 404s when
absent), and the event-sourced write surface. The UI patterns are all established by prior slices:
`ArtemisClient` seam with fixtures, TanStack optimistic mutations with rollback + invalidate,
per-entity mutation `scope`, `PostSummary`-driven thumbnails via `mediaUrl`/`thumbnailVariant`.

## Goals / Non-Goals

**Goals:** browse pools; read a pool as an ordered gallery; full pool CRUD + membership + reorder;
add-to-pool from the post view; keyboard-accessible reorder; optimistic everything with honest
rollback. **Non-goals:** reverse lookup, `pool:` metatag, cover selection, bulk operations.

## Decisions

### D1 — Query keys and where each read comes from

- `["pools"]` — infinite query over `listPools` (index cards). `staleTime` 30s like the other
  browse reads.
- `["pool", id, "posts"]` — infinite query over `poolPosts` (hydrated members for the gallery).
- `["pool", id]` — the ENTITY read (`getPool`): the authoritative ordered id list + name, and the
  404 signal for the not-found state. The detail view renders the gallery from the hydrated
  members but **orders and mutates against the entity list** — read-your-writes, no projection
  lag in the editor. Hydrated rows are keyed into a map by id; members missing from the hydrated
  page (projection lag after an add) render as placeholder tiles rather than vanishing.
- Post-view "add to pool" reuses `["pools"]` for its picker list.

### D2 — Mutations: optimistic on the entity list, serialized per pool

All writes go through a shared TanStack mutation `scope: { id: "pool-mutation-<id>" }` (same
serialization pattern as post mutations) so a rapid reorder-then-remove can't interleave.

- `reorder(order)` — optimistic: write the new id order into `["pool", id]`; onError restore the
  snapshot; onSettled invalidate `["pool", id]` + `["pool", id, "posts"]`. The API takes the FULL
  permutation, so the optimistic value and the request body are the same array (no drift).
- `addPost(postId)` / `removePost(postId)` — optimistic append/remove on `["pool", id]`;
  invalidate both pool keys + `["pools"]` (counts/covers change).
- `rename(name)` — optimistic on `["pool", id]`; invalidate `["pools"]`.
- `createPool` / `deletePool` — no optimistic insert (navigation follows); invalidate `["pools"]`.
  Delete navigates back to `/pools` on success.

### D3 — Reorder interaction: pointer drag AND keyboard buttons

Reordering must not be drag-only (a11y bar set by prior slices). Two mechanisms over one state:

- **Pointer:** HTML drag-and-drop on the gallery tiles (draggable list items, dragover computes the
  insertion index, drop commits the permutation). No external dnd library — the list is a simple
  grid and the interaction is move-one-tile.
- **Keyboard:** each tile (when the pool is in "arrange" mode) exposes ◀/▶ move buttons
  (aria-labels "Move earlier/later"), operable by Tab + Enter. The same `move(fromIndex, toIndex)`
  builds the permutation.
- An explicit **Arrange** toggle on the detail view switches the gallery between "browse" (tiles
  link to posts) and "arrange" (tiles drag/move/remove; links disabled) — avoids drag-vs-click
  ambiguity on the same tile.

Each committed move fires one `reorder` mutation (serialized by scope); rapid moves coalesce
naturally because the optimistic entity order is the source for the next permutation.

### D4 — Create dialog: name → derived slug id

`POST /pools` needs a caller-chosen `id`. The dialog asks for a **name**; the id is derived as a
kebab-case slug (lowercase, `[a-z0-9-]`, collapse dashes), shown in the dialog and editable for
the rare case the user wants a specific id. A 409 (`PoolAlreadyExists`) surfaces inline on the id
field. Client-side guard mirrors the server's id validation (non-empty after slugging).

### D5 — Not-found and empty semantics

The detail view keys off the ENTITY read: its 404 → the designed "Pool not found" state (same
pattern as the post view). The hydrated members read never 404s, so it can't be the signal. An
existing pool with no members renders the designed empty state with the add-by-id affordance.

### D6 — Fixtures

`fixtureClient` models pools as a mutable module-level array over the existing fixture posts
(2 seeded pools: one multi-member ordered, one empty), implementing every method incl. keyset
paging (slice by cursor index), covers (first visible member summary), 409 on duplicate create,
and permutation validation on reorder — so the whole slice is browser-verifiable offline, per
the established convention.

## Risks / Trade-offs

- **Projection lag between entity order and hydrated rows** — mitigated by D1 (order from the
  entity, hydration as a lookup map, placeholder tiles for not-yet-projected members; invalidation
  reconciles).
- **Drag-and-drop keyboard parity** — solved structurally (D3's buttons), not by aria-grabbed
  theatrics.
- **One reorder request per move** could chatter on long arranging sessions — acceptable at
  single-user scale; the scope serializes them. A "commit on exit arrange mode" batch is a later
  refinement if it ever matters.

## Open Questions

- (none blocking — reverse lookup ("which pools contain this post") wants an Artemis route before
  the post-view action can show current membership; deferred with the non-goals.)
