# Change: design-artemis-ui-review

> **Design capture.** The auto-tag **review queue** — where a human clears the backlog of AI tag
> suggestions (Argus) by unchecking the wrong ones and accepting the rest. Third catalog write
> slice (after post-edit, upload). Pools and saved-searches remain.

## Why

Auto-tagging (Argus → `design-artemis-auto-tagging`) produces **suggestions**, never applied tags —
by design, the human is the source of truth. The payoff needs a place to review them: batch-upload
untagged media, then rip through a queue later, un-checking wrong suggestions and accepting the
rest. This turns tagging from typing-from-scratch into a fast review — the whole point of
auto-tagging — and it's the capability that ties the ops/ingest and catalog halves of the console
together. Artemis exposes the queue and the accept endpoint; this drives them.

## What Changes

- A **Review** view listing posts awaiting review (`GET /review`), each with its suggestions shown
  as **pre-checked chips** (category-colored, sorted by confidence, confidence + source shown). The
  human unchecks the wrong ones; **Accept** applies the still-checked set via
  `POST /posts/{id}/review {accept:[…]}`; **Reject all** clears the review applying nothing
  (`{accept:[]}`). Resolving a post removes it from the queue and advances to the next
  (batch-friendly).
- A **needs-review count** badge on the Review nav entry, derived from the queue length (Artemis has
  no dedicated count endpoint).
- The `ArtemisClient` gains `getReviewQueue()` and `reviewPost(id, accept)`; the "Review" Catalog
  nav entry goes live.

## Capabilities

### New Capabilities
- `catalog-review`: a review queue of posts with pre-checked, category-colored suggestion chips;
  per-post accept-selected / reject-all; batch navigation; a needs-review nav badge.

### Modified Capabilities
- (none — additive; app-shell activates its "Review" Catalog nav entry.)

## Impact

- **Artemis API consumed:** `GET /review?limit=` → `{posts:[{postId, suggestions:[{tag, confidence,
  source}]}]}`; `POST /posts/{id}/review {accept?:string[]}` (absent/empty ⇒ reject-all). No
  `/review/count` endpoint exists — the badge uses the queue length.
- `ArtemisClient` + both implementations gain the two methods; the fixture models a small review
  backlog that shrinks as posts are resolved.
- Suggestion chips reuse the category colors via `useTagCategories` (tag names → category) and the
  existing chip/label components.

## Non-goals / out of scope

- Auto-accept-above-confidence (a later opt-in); adding arbitrary NEW tags at review time (that's
  post-edit on the post view — review is select-from-suggestions); multi-user review attribution;
  editing the suggestions' confidence. Bulk "accept all in queue" is out (per-post review is the
  safety point) though fast per-post accept + auto-advance gives most of the speed.
