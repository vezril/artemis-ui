# Change: design-artemis-ui-post-edit

> **Design capture.** The first catalog **write** slice — inline editing on the post view:
> grammar-aware tag editing, favorite, score, and rating, with optimistic updates. Turns the
> read-only post view (`catalog-post`) interactive. Upload, pools, review, and saved-searches are
> later write slices.

## Why

The catalog is browsable but not editable — a post's tags, rating, score, and favorite can't be
changed from the console. Tag curation is the core of a booru, so making the post view editable is
the highest-value write slice and the natural next step after the read surface. Artemis already
exposes all four mutations; this wires them up with the optimistic, low-friction UX the read side
established.

## What Changes

- A **tag editor** on the post view: the grammar-aware tag input (reusing the search box's
  autocomplete — category-colored, counts, alias hints) edits the post's tag set; save replaces the
  set via `PATCH /posts/{id}/tags`. Optimistic: the sidebar updates immediately and rolls back on
  failure.
- **Favorite** toggle (`POST`/`DELETE /posts/{id}/favorite`) — optimistic star.
- **Score** up/down (`POST /posts/{id}/score {delta}`) — Artemis scores by DELTA, so the control
  sends +1/-1 and shows the current score; optimistic.
- **Rating** control (`PATCH /posts/{id}/rating {rating}`) — g/s/q/e, optimistic.
- The `ArtemisClient` gains `patchTags`, `setFavorite`, `scorePost`, `setRating` in both fixture and
  http implementations; the post view gains the edit affordances behind an "Edit" affordance.

## Capabilities

### New Capabilities
- `catalog-post-edit`: inline editing of a post's tags (grammar-aware), favorite, score (delta), and
  rating on the post view, with optimistic updates + rollback.

### Modified Capabilities
- (none — additive to the post view; `catalog-post` stays a read spec, this adds the write actions.)

## Impact

- **Artemis API consumed:** `PATCH /posts/{id}/tags`, `POST`/`DELETE /posts/{id}/favorite`,
  `POST /posts/{id}/score`, `PATCH /posts/{id}/rating`. All unauthenticated.
- `ArtemisClient` + both implementations gain the four write methods; TanStack Query mutations with
  optimistic cache updates keyed on the post query.
- Reuses the existing grammar-aware tag input, category colors, and the `ApiError` handling.

## Non-goals / out of scope

- Upload, pools, the review queue, saved searches (later write slices).
- Bulk tag edits, tag-edit history/undo beyond optimistic rollback, auth/attribution (single-user).
- Absolute score setting (Artemis is delta-based; the UI votes +1/-1).
