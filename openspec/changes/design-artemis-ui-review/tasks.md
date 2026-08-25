# Tasks — design-artemis-ui-review

## 1. ArtemisClient review methods + types
- [x] 1.1 `types.ts`: `ReviewSuggestion {tag, confidence, source}`, `ReviewItem {postId, suggestions[]}`.
- [x] 1.2 `client.ts`: `getReviewQueue(limit?): Promise<ReviewItem[]>`, `reviewPost(id, accept: string[]): Promise<void>`.
- [x] 1.3 `http.ts`: `GET /review?limit=` (parse `{posts:[...]}`, validate), `POST /posts/{id}/review {accept}` (empty ⇒ reject-all); ApiError on non-2xx.
- [x] 1.4 `fixtures.ts`: a small review backlog (a few posts with confidence/source-varied suggestions) that shrinks as posts are resolved.

## 2. Review queue hook
- [x] 2.1 `use-review.ts`: `useReviewQueue()` — fetch the queue (`["review"]`), optimistic resolve (remove locally on accept/reject, re-insert on error), and expose the count.

## 3. Review view (catalog-review)
- [x] 3.1 `/review` route + view: the queue as per-post cards; each card shows pre-checked, confidence-sorted, category-colored suggestion chips (confidence + source), toggle to uncheck, Accept / Reject-all, auto-advance; empty state; per-card error on failed resolve.
- [x] 3.2 Category colors for suggestion tags via `useTagCategories`; reuse chip/label + confidence rendering.

## 4. Navigation + badge
- [x] 4.1 Activate the Catalog "Review" nav entry → `/review` (drop coming-soon); show a needs-review count badge from the queue length (a lightweight shared query so the badge is present app-wide).

## 5. Verify
- [x] 5.1 Fixtures exercise the queue + accept (subset) + reject-all; component tests: accept posts the checked subset & removes the card; reject-all posts empty & removes; a failed resolve re-inserts + shows error.
- [x] 5.2 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` green.
- [x] 5.3 `openspec validate design-artemis-ui-review --strict`.
- [x] 5.4 Browser smoke (fixtures): review a post — uncheck one, Accept → advances; Reject all on another.
