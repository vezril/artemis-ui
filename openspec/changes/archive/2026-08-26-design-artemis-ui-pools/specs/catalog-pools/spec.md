# catalog-pools

Danbooru-style ordered collections: browse pools as cover cards, read one as an ordered gallery,
create/rename/delete, add/remove members, reorder (pointer and keyboard).

## ADDED Requirements

### Requirement: Browse pools as cover cards

The Pools index MUST list pools from `GET /pools` as cards showing the pool's cover thumbnail
(or a placeholder when `cover` is null), name, and member count, loading more via the keyset
cursor. A **New pool** action MUST create a pool from a name (id derived as an editable slug),
surfacing a duplicate-id conflict inline.

#### Scenario: Index renders cards
- **WHEN** `GET /pools` returns pools with covers and counts
- **THEN** each renders as a card (cover thumbnail or placeholder, name, count) linking to its detail view, with more pages loaded via `nextCursor`

#### Scenario: Create a pool
- **WHEN** the user enters a name in the New pool dialog and submits
- **THEN** `POST /pools` is called with the derived slug id and the name, and on success the new pool appears (list refreshed)

#### Scenario: Edge case — duplicate id conflicts inline
- **WHEN** `POST /pools` returns 409
- **THEN** the dialog shows the conflict on the id field and does not close

### Requirement: Read a pool as an ordered gallery

The pool detail view MUST render the pool's members **in pool order** as post tiles (thumbnail via
the hydrated members read), each linking to its post in browse mode. Order MUST be driven by the
entity read (`GET /pools/{id}` — read-your-writes); a member not yet present in the hydrated
projection page renders as a placeholder tile rather than disappearing. An unknown pool (entity
404) MUST show a designed not-found state; an empty pool shows a designed empty state.

#### Scenario: Ordered gallery
- **WHEN** the entity lists members p3, p1, p2 and the hydrated read returns their summaries
- **THEN** tiles render in the order p3, p1, p2 with real thumbnails

#### Scenario: Edge case — unknown pool
- **WHEN** `GET /pools/{id}` returns 404
- **THEN** a designed "Pool not found" state renders (no crash, no infinite spinner)

### Requirement: Manage a pool

The detail view MUST support inline rename (`PATCH /pools/{id}`), deleting the pool
(`DELETE /pools/{id}`) behind an explicit confirm, and removing a member
(`DELETE /pools/{id}/posts/{postId}`). Mutations apply optimistically with rollback on error and
reconcile by invalidation; a failed mutation surfaces an attributed, dismissible error.

#### Scenario: Rename applies optimistically
- **WHEN** the user renames the pool
- **THEN** the new name shows immediately and persists on success; on failure the old name returns with an error shown

#### Scenario: Delete navigates home
- **WHEN** the user confirms Delete pool
- **THEN** the pool is deleted and the view navigates back to the pools index

### Requirement: Reorder members — pointer AND keyboard

In an explicit **Arrange** mode, members MUST be reorderable by pointer drag AND by per-tile
move-earlier/move-later buttons (keyboard operable, aria-labeled) — never drag-only. Each committed
move sends the full permutation to `PUT /pools/{id}/order`, applied optimistically (order updates
immediately) with rollback on error. In arrange mode tiles do not navigate.

#### Scenario: Keyboard move
- **WHEN** the user activates "Move earlier" on the third tile
- **THEN** it swaps into second place immediately and the full new order is PUT; on failure the previous order returns with an error

#### Scenario: Pointer drag
- **WHEN** the user drags a tile to a new position and drops
- **THEN** the order updates optimistically and the permutation is PUT

### Requirement: Add a post to a pool

The post view MUST offer an "Add to pool" action listing existing pools; choosing one appends the
post (`POST /pools/{id}/posts`, idempotent server-side). The pool detail MUST also accept adding
by post id. Success reflects in the pool's count/members on next read (optimistic append on the
entity order where the detail view is open).

#### Scenario: Add from the post view
- **WHEN** the user picks a pool in the post view's Add to pool action
- **THEN** the post is appended to that pool and the action confirms (idempotent re-add stays a success)

#### Scenario: Edge case — add by id validates presence
- **WHEN** an empty post id is submitted on the detail view
- **THEN** no request is made and the field shows validation feedback
