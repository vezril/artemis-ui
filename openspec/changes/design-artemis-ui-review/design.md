## Context

Argus posts tag suggestions to Artemis, which queues them for human review (suggestions are never
auto-applied). `GET /review` returns the backlog (`{postId, suggestions:[{tag, confidence,
source}]}`); `POST /posts/{id}/review {accept?}` resolves one post — accepting the listed tags, or
rejecting all when `accept` is absent/empty. This slice is the human review UX over that.

## Goals / Non-Goals

**Goals:** clear the review backlog fast — pre-checked suggestion chips, uncheck the wrong, accept
the rest (or reject all), auto-advance; a needs-review badge.

**Non-Goals:** auto-accept, adding new tags at review (post-edit does that), attribution, editing
confidence, a bulk "accept everything" button.

## Decisions

- **Pre-checked, human-subtractive.** Every suggestion starts checked; the human unchecks the wrong
  ones and accepts. This matches the "review, don't type" goal and the reject-few / accept-many
  reality of a decent tagger. Chips are sorted by confidence (desc) and category-colored; confidence
  and source are shown so a low-confidence or odd-source suggestion stands out.
- **Accept sends the checked set; Reject-all sends `{accept:[]}`.** `POST /posts/{id}/review` with
  the currently-checked tags; reject-all resolves the post applying nothing. Both remove the post
  from the queue.
- **Optimistic queue removal + auto-advance.** On accept/reject, the post is removed from the local
  queue immediately (optimistic) so the reviewer moves to the next without waiting; a failure
  re-inserts it with the error surfaced. The badge count follows the local queue.
- **Queue fetched once, resolved locally.** `GET /review` seeds the list; resolutions mutate the
  local list (and invalidate on settle). We don't re-fetch the whole queue per resolution (that
  would reshuffle the reviewer's place).
- **Category colors via lookup.** Suggestions carry only a tag name; resolve categories with the
  same `useTagCategories` autocomplete lookup the tag sidebar uses (documented fan-out limitation).
- **Badge from queue length.** No `/review/count`; the nav badge reads the fetched queue's length
  (a small poll/refetch keeps it fresh). Zero → no badge.

## Risks / Trace-offs

- **Stale suggestions.** A suggestion set carries no version, so a re-delivery after a human already
  reviewed could re-queue a post (Artemis-side known limitation). The UI just shows whatever the
  queue returns; resolving again is safe (idempotent replace).
- **Optimistic removal vs failure.** A failed resolve re-inserts the post; because the reviewer may
  have moved on, the re-inserted post appears back in the list with an error rather than yanking
  focus — accepted.
- **Empty catalog today.** With no posts/Argus running, the live queue is empty (empty-state
  render); fixtures provide a backlog so the flow is demonstrable.
