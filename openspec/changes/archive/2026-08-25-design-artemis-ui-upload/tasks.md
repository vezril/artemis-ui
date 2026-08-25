# Tasks — design-artemis-ui-upload

## 1. ArtemisClient upload
- [x] 1.1 `client.ts`: add `upload(file: File, mediaType?: string): Promise<{ postId: string; status: string }>`.
- [x] 1.2 `http.ts`: `POST /uploads?mediaType=<class>` with `body: file`, `content-type: file.type`; parse `{postId, status}`; map 400/502 `{error}` to ApiError.
- [x] 1.3 `fixtures.ts`: create a fixture post that transitions pending→active over a few `getPost` polls (so the lifecycle is demonstrable offline).

## 2. Upload state machine + hook
- [x] 2.1 A per-file upload model (`queued → uploading → pending → active | failed | error`) with the postId once known; a `useUploads()` controller managing the list.
- [x] 2.2 A status poller: for each pending post, poll `GET /posts/{id}` under a `["upload-status", id]` key; stop on terminal; bounded window → resting pending; manual refresh.

## 3. Uploads view (catalog-upload)
- [x] 3.1 `/uploads` route + Dropzone (drag-drop + file picker, image/video), streaming each file.
- [x] 3.2 Upload rows: filename/size, status badge (uploading indeterminate / pending / active / failed / error), thumbnail + post link once active, per-row retry on error.
- [x] 3.3 Honest pending copy ("awaiting processing"); no fabricated processing progress.

## 4. Navigation
- [x] 4.1 Activate the Catalog "Uploads" nav entry → `/uploads` (drop its coming-soon).

## 5. Verify
- [x] 5.1 Fixtures exercise upload + the pending→active transition; a component test (upload a file → row goes pending then active) and one for a failed upload showing the error + retry.
- [x] 5.2 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` green.
- [x] 5.3 `openspec validate design-artemis-ui-upload --strict`.
- [x] 5.4 Browser smoke (fixtures): drop a file → uploading → pending → active with a post link.
