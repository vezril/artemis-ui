# Change: design-artemis-ui-upload

> **Design capture.** The upload write slice — drop files, stream each to Artemis, and follow its
> ingest status live. Second of the catalog write slices (after post-edit). Pools, review, and
> saved-searches follow.

## Why

The console can browse and edit the catalog but can't add to it. Upload is the entry point of the
whole pipeline (bytes → Apollo → a pending post → Hephaestus derivatives → active), and the last
core interactive capability before artemis-ui fully replaces Muses. Artemis exposes a raw-body
upload plus per-post status, so the console can drive it and reflect the async ingest live.

## What Changes

- An **Uploads** view: a dropzone / file picker that accepts image and video files. Each file is
  streamed to `POST /uploads` (RAW request body; `Content-Type` sets the MIME type; `?mediaType=`
  derived from it) → `201 {postId, status:"pending"}`.
- **Per-file upload rows** showing filename/size, a status badge, and — once known — a thumbnail +
  a link to the post. Status is followed live by polling `GET /posts/{id}` and reading its `status`
  (`pending → active | failed`); the row stops polling on a terminal state.
- **Honest pending state.** On the live cluster the media processor (Hephaestus) may not be
  deployed, so an uploaded post can stay `pending` indefinitely — the UI shows "pending
  (awaiting processing)" plainly and never fakes a progress bar for work that isn't happening. In
  fixtures the full `pending → active` lifecycle is simulated so the flow is demonstrable offline.
- The `ArtemisClient` gains `upload(file, mediaType?)` and `getPost` is reused for status polling;
  the Catalog "Uploads" nav entry goes live.

## Capabilities

### New Capabilities
- `catalog-upload`: a dropzone that streams files to `POST /uploads` and tracks each post's ingest
  status live (`pending → active | failed`), with honest handling of an indefinitely-pending post.

### Modified Capabilities
- (none — additive; app-shell activates its "Uploads" Catalog nav entry.)

## Impact

- **Artemis API consumed:** `POST /uploads?mediaType=` (raw body), `GET /posts/{id}` (status poll).
  All unauthenticated. A `502` from Artemis (Apollo/Hermes down) surfaces per-file; empty body 400.
- `ArtemisClient` + both implementations gain `upload`; a per-upload status poll uses the existing
  `getPost` under a distinct query key so it doesn't fight the post view's cache.
- The BFF proxy already streams request bodies (raw upload passes through server-side).

## Non-goals / out of scope

- Client-side transcoding/thumbnailing (Hephaestus does derivatives); editing tags at upload time
  (upload first, edit on the post view — the review/tag slices cover bulk tagging);
  multipart/form-data (Artemis takes a raw body); resumable/chunked uploads; auth.
- Driving Hephaestus or asserting an uploaded post reaches `active` on the live cluster (that's the
  ingest e2e once the worker is deployed).
