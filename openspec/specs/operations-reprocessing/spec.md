# operations-reprocessing Specification

## Purpose
TBD - created by archiving change design-artemis-ui-operations. Update Purpose after archive.
## Requirements
### Requirement: Build a reprocess request

The Reprocess view MUST build a `{select, kind}` request. `select` is one of: `stale`, a single
`id:<postId>`, or a free-form search-DSL query. `kind` is one of `derivatives`, `metadata`,
`tags`. The form makes the three selection modes distinct and validates that a `kind` is
chosen before submit.

#### Scenario: Single-post selection
- **WHEN** the operator picks "one post" and enters a post id
- **THEN** the request `select` is `id:<postId>`

#### Scenario: Stale selection
- **WHEN** the operator picks "stale"
- **THEN** the request `select` is `stale`

#### Scenario: DSL selection
- **WHEN** the operator picks "query" and enters a search-DSL string
- **THEN** the request `select` is that DSL string verbatim

### Requirement: Confirm a broad selection before enqueuing

A broad selection (`stale`, or a DSL query) MUST require an explicit confirmation step before the
`POST /reprocess`. A single-post selection may submit directly. Where possible the confirm
step previews the match count by running the same query through `GET /posts`.

#### Scenario: Broad selection is gated
- **WHEN** the selection is `stale` or a DSL query
- **THEN** submitting first shows a confirmation (with a match-count preview when available),
  and the POST only fires after explicit confirm

#### Scenario: Single post submits directly
- **WHEN** the selection is a single `id:<postId>`
- **THEN** no extra confirmation is required

### Requirement: Report the outcome

On success the view MUST report the returned `{enqueued}` count. On a `400` (bad `kind` or bad
DSL selection) it surfaces the server's `{error}` message inline without losing the form
input.

#### Scenario: Success
- **WHEN** `POST /reprocess` returns `200 {"enqueued": n}`
- **THEN** the view reports that `n` jobs were enqueued

#### Scenario: Rejected request
- **WHEN** `POST /reprocess` returns `400 {"error": "..."}`
- **THEN** the view shows the error inline and preserves the operator's input for correction

