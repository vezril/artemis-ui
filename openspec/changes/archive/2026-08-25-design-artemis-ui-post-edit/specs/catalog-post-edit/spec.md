# catalog-post-edit

Inline editing of a post's tags, favorite, score, and rating on the post view, optimistic with
rollback.

## ADDED Requirements

### Requirement: Edit a post's tags

The post view MUST let the operator edit the post's tag set via a grammar-aware input (the search
autocomplete, tag context) and save it with `PATCH /posts/{id}/tags` (a full-set replace). The
update is optimistic — the tag sidebar reflects the change immediately and rolls back with the
error surfaced on failure.

#### Scenario: Add and save a tag
- **WHEN** the operator adds a tag in the editor and saves
- **THEN** `PATCH /posts/{id}/tags` is called with the full resulting set and the sidebar shows it

#### Scenario: Save failure rolls back
- **WHEN** the tag save fails
- **THEN** the sidebar reverts to the prior tags and the error is shown

### Requirement: Toggle favorite

The post view MUST let the operator toggle favorite via `POST`/`DELETE /posts/{id}/favorite`,
optimistically, rolling back on failure.

#### Scenario: Favorite toggles optimistically
- **WHEN** the operator clicks favorite
- **THEN** the star toggles immediately and the matching favorite request is sent (rollback on error)

### Requirement: Vote score

The post view MUST let the operator raise or lower the score via `POST /posts/{id}/score {delta}`
(Artemis scores by delta), optimistically adjusting the shown score.

#### Scenario: Upvote sends +1
- **WHEN** the operator upvotes
- **THEN** a `{delta: 1}` request is sent and the shown score increments (rollback on error)

### Requirement: Set rating

The post view MUST let the operator set the rating (g/s/q/e) via `PATCH /posts/{id}/rating`,
optimistically.

#### Scenario: Change rating
- **WHEN** the operator picks a rating
- **THEN** `PATCH /posts/{id}/rating {rating}` is sent and the shown rating updates (rollback on error)
