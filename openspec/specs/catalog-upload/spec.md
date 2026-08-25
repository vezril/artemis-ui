# catalog-upload Specification

## Purpose
TBD - created by archiving change design-artemis-ui-upload. Update Purpose after archive.
## Requirements
### Requirement: Drop or pick files to upload

The Uploads view MUST accept image/video files via a dropzone and a file picker, and stream each
selected file to `POST /uploads` as the raw request body with its `Content-Type` and a derived
`?mediaType=`. Each file is an independent upload row.

#### Scenario: Upload a file
- **WHEN** the operator drops or picks a file
- **THEN** its bytes are streamed to `POST /uploads?mediaType=<class>` with the file's content type,
  and a row appears tracking it

#### Scenario: Per-file failure is isolated
- **WHEN** one file's upload returns an error (400/502/network)
- **THEN** that row shows the error with a retry, and the other files' uploads are unaffected

### Requirement: Follow ingest status live

Once a file uploads (`201 {postId, status:"pending"}`), its row MUST follow the post's status by
polling `GET /posts/{id}`, updating the badge as `pending → active | failed`, and STOP polling on a
terminal status. A post that stays pending settles to a resting "still pending" state after a
bounded number of polls (with a manual refresh), never polling forever.

#### Scenario: Pending to active
- **WHEN** an uploaded post's status becomes `active`
- **THEN** the row shows active (with a thumbnail + a link to the post) and stops polling

#### Scenario: Stuck pending settles
- **WHEN** the post is still `pending` after the bounded poll window
- **THEN** the row shows "pending — awaiting processing" at rest (manual refresh available), not a
  fake progress indicator and not an endless poll

### Requirement: Honest status, no fabricated progress

The view MUST NOT display processing progress that is not real: only the byte-transfer phase shows
indeterminate progress; a server-side `pending` post is shown as pending, since the console does not
control (and cannot observe) the media worker's progress.

#### Scenario: Pending is not faked
- **WHEN** a post is `pending`
- **THEN** the row shows a pending state, not a progress bar implying active processing

