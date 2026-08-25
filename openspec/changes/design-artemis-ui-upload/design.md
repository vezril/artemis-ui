## Context

Upload is the pipeline entry point. Artemis's `POST /uploads` takes the file bytes as the RAW
request body (not multipart), with `Content-Type` as the MIME type and an optional `?mediaType=`
override; it answers `201 {postId, status:"pending"}` and creates a pending post. The post then
progresses `pending → active` when Hephaestus records derivatives (or `failed`). The UI streams
files and follows that status.

## Goals / Non-Goals

**Goals:** drop image/video files, stream each to Artemis, and reflect each post's live ingest
status; honest about an indefinitely-pending post.

**Non-Goals:** multipart, chunked/resumable uploads, client transcoding, upload-time tagging, auth,
or asserting `active` on a cluster without Hephaestus.

## Decisions

- **Raw-body upload, one request per file.** `fetch(POST /uploads?mediaType=<class>, { body: file,
  headers: { "content-type": file.type } })`. `mediaType` = the top-level type (`image`/`video`);
  for `application/octet-stream` or unknown, send the top-level type as-is. No multipart.
- **Live status via post polling, not a separate endpoint.** Artemis has no `/status` endpoint we
  rely on; the row polls `GET /posts/{id}` (which returns `status`) under a per-post query key
  (`["upload-status", id]`) so it doesn't disturb the post-view cache. Polling stops on a terminal
  status (`active`/`failed`) and after a bounded number of polls it settles to a "still pending"
  resting state (it keeps a manual refresh) rather than polling forever.
- **Honest pending.** A `pending` row shows "pending — awaiting processing", not a fabricated
  progress bar. Only `uploading` (the byte transfer) shows indeterminate progress; once the 201
  lands the post is server-side and the row reflects the real `status`.
- **Per-file isolation.** Each file is its own row/state machine (`queued → uploading → pending →
  active | failed | error`); one file's failure never blocks the others. A `502`/`400`/network
  error on a file surfaces on its row with a retry.
- **Fixtures simulate the lifecycle.** The fixture `upload` creates a fixture post that transitions
  `pending → active` over a few status polls, so the whole flow is demonstrable offline; the live
  client reflects whatever Artemis actually reports.

## Risks / Trade-offs

- **Indefinitely-pending on live** (no Hephaestus yet): handled by the honest resting state; not a
  UI bug. Documented in the view.
- **Large files / memory**: `fetch` with a `File` body streams via the browser + the BFF's
  duplex passthrough; no full in-memory buffering in our code. Very large videos rely on the
  browser/undici streaming — acceptable at homelab scale.
- **Duplicate uploads** (same file twice): Artemis dedups by md5 server-side (content-addressed), so
  a re-upload returns/attaches to the existing post — the UI just shows another pending row that
  resolves to the same/active post; acceptable.
