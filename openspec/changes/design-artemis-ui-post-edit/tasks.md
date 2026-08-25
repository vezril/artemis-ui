# Tasks — design-artemis-ui-post-edit

## 1. ArtemisClient write methods
- [x] 1.1 `client.ts`: add `patchTags(id, tags[])`, `setFavorite(id, fav)`, `scorePost(id, delta)`, `setRating(id, rating)`.
- [x] 1.2 `http.ts`: implement — PATCH /posts/{id}/tags, POST|DELETE /posts/{id}/favorite, POST /posts/{id}/score {delta}, PATCH /posts/{id}/rating {rating}; map non-2xx {error} to ApiError.
- [x] 1.3 `fixtures.ts`: mutate the in-memory post so edits persist in-session (tags replace, favorite toggle, score += delta, rating set).

## 2. Optimistic mutation hooks
- [x] 2.1 `use-catalog.ts` (or a new hook): `usePostMutations(id)` with TanStack Query mutations — onMutate snapshot+patch `["post", id]`, onError rollback + expose error, onSettled invalidate.

## 3. Post-view edit affordances (catalog-post-edit)
- [x] 3.1 Tag editor: an "Edit tags" toggle in the sidebar → the grammar-aware input (tag context) seeded with current tags as chips; Save (patchTags) / Cancel; optimistic.
- [x] 3.2 Favorite toggle (star), Score up/down + current score, Rating control (g/s/q/e) on the post-actions bar; all optimistic.
- [x] 3.3 Inline error surfacing on any failed mutation; controls disabled while a mutation is in flight where it matters.

## 4. Verify
- [x] 4.1 Fixtures exercise every new method; a component test for the tag editor (add→save patches) and one for optimistic favorite rollback on error.
- [x] 4.2 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` green.
- [x] 4.3 `openspec validate design-artemis-ui-post-edit --strict`.
- [x] 4.4 Browser smoke (fixtures): edit tags, favorite, vote score, change rating on a post.
