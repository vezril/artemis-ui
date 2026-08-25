## Context

The post view (`catalog-post`) renders a post read-only. Artemis exposes four post mutations
(tags/favorite/score/rating), all unauthenticated. This slice makes the post view editable with the
optimistic UX pattern the read side established, reusing the grammar-aware tag input from search.

## Goals / Non-Goals

**Goals:** edit a post's tags (grammar-aware), toggle favorite, vote score, set rating — inline on
the post view, optimistic with rollback on failure.

**Non-Goals:** upload/pools/review/saved-searches (later slices); bulk edits; edit history; auth.

## Decisions

- **Optimistic mutations via TanStack Query.** Each mutation does `onMutate` (snapshot + patch the
  cached `Post`), `onError` (rollback to snapshot + surface the `ApiError`), `onSettled`
  (invalidate the post query to reconcile). Keyed on the `["post", id]` query.
- **Score is a delta.** Artemis `POST /posts/{id}/score` takes `{delta}` and the post carries the
  current absolute `score`. The control sends +1/-1 and optimistically adjusts the shown score; it
  is a vote, not an absolute set.
- **Tag editing replaces the whole set.** `PATCH /posts/{id}/tags {tags}` is a replace. The editor
  starts from the post's current tags as removable chips + the grammar-aware input to add; Save
  sends the full resulting set. Reuses the search box's autocomplete (tag vs metatag context is
  irrelevant here — only real tags — so the editor uses tag-context completions only).
- **Edit is explicit, not always-on.** The sidebar shows tags read-only with an "Edit tags"
  affordance that swaps in the editor; favorite/score/rating are always-interactive controls (a
  single click is low-risk and optimistic). Rating and score are not destructive; tags Save is a
  deliberate action.
- **Reuse, don't fork.** The tag chips, category colors, and `TagLabel` come from the read slice;
  the editor is a thin wrapper over the existing components.

## Risks / Trade-offs

- **Optimistic vs eventual consistency.** Artemis's read model is eventually consistent, but
  `GET /posts/{id}` reads the entity (read-your-writes), so the post-query invalidation reconciles
  correctly. Search results (projection) may lag — out of scope here (we invalidate only the post).
- **Delta races.** Rapid score clicks send multiple deltas; each is independent and additive, so the
  server stays correct; the optimistic value may transiently diverge but reconciles on invalidate.
- **Fixture fidelity.** The fixture client mutates its in-memory post so edits persist within a
  session; it can't model server-side validation nuances — acceptable (fixtures aren't the spec).
