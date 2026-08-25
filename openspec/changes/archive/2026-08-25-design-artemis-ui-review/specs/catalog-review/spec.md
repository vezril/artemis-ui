# catalog-review

A human review queue for AI tag suggestions: pre-checked chips, accept-selected / reject-all,
auto-advance, a needs-review badge.

## ADDED Requirements

### Requirement: List the review queue

The Review view MUST fetch `GET /review` and render each queued post with its suggestions as chips,
each chip **pre-checked**, sorted by confidence (descending), category-colored, and showing the
confidence and source. An empty queue shows an empty state.

#### Scenario: Queue with suggestions
- **WHEN** `GET /review` returns posts with suggestions
- **THEN** each post renders its suggestions as pre-checked, confidence-sorted, category-colored chips

#### Scenario: Empty queue
- **WHEN** the queue is empty
- **THEN** an empty state is shown (nothing to review)

### Requirement: Accept the checked suggestions

The view MUST let the reviewer uncheck wrong suggestions and Accept the rest via
`POST /posts/{id}/review {accept:[checked tags]}`. On success the post is removed from the queue and
the view advances to the next.

#### Scenario: Accept a subset
- **WHEN** the reviewer unchecks some chips and clicks Accept
- **THEN** `POST /posts/{id}/review` is called with only the still-checked tags, and the post leaves
  the queue

### Requirement: Reject all suggestions

The view MUST let the reviewer reject all suggestions for a post via `POST /posts/{id}/review`
with an empty/absent `accept` (applies nothing, clears the review). The post leaves the queue.

#### Scenario: Reject all
- **WHEN** the reviewer clicks Reject all
- **THEN** `POST /posts/{id}/review` is called with no accepted tags and the post leaves the queue

### Requirement: Optimistic resolve with rollback

Resolving a post MUST remove it from the queue optimistically (so review is fast); a failed resolve
re-inserts the post and surfaces the error, without applying anything.

#### Scenario: Failed resolve is recoverable
- **WHEN** an accept/reject request fails
- **THEN** the post reappears in the queue with an error shown, and can be retried

### Requirement: Needs-review badge

The Review nav entry MUST show a needs-review count derived from the queue length, and it updates as
posts are resolved. Zero shows no badge.

#### Scenario: Badge reflects the queue
- **WHEN** the queue has N posts
- **THEN** the Review nav entry shows N; resolving a post decrements it; at 0 the badge disappears
