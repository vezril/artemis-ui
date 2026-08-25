# Tasks — design-artemis-ui-maintenance

## 1. ArtemisClient admin methods
- [x] 1.1 `types.ts`: add `PostStatus`, `PurgeOutcome {purged, blobsDeleted}`, `SweepOutcome {scanned, orphans, deleted}` types.
- [x] 1.2 `client.ts`: extend `ArtemisClient` with `deletePost(id)`, `restorePost(id)`, `purgePost(id)`, `orphanSweep(dryRun)`, `purgeDeleted()`.
- [x] 1.3 `http.ts`: implement all five against the admin endpoints; map non-2xx `{error}` to `ApiError`; validate the response shapes.
- [x] 1.4 `fixtures.ts`: implement all five with a small in-memory post-status map so delete→restore→purge transitions are believable offline.

## 2. Posts maintenance view (post-lifecycle)
- [x] 2.1 `/maintenance/posts` route + `PostAdminView`: id input; Delete (confirm) / Restore (direct) / Purge (confirm, "permanent") actions.
- [x] 2.2 Report the result (status, or `{purged, blobsDeleted}`); surface `404`/`4xx` `{error}` inline; a `purged:false` is a normal result, not an error.

## 3. Garbage-collection view (gc-maintenance)
- [x] 3.1 `/maintenance/gc` route + `GcView`: Orphan sweep — dry-run first (show `{scanned, orphans}`), then a separate confirmed real run (show `{deleted}`); the real run is not offered until a dry-run is shown.
- [x] 3.2 Retention purge — a confirmed `purge-deleted` action reporting `{purged}`.
- [x] 3.3 Inline error reporting for failed GC calls (retryable).

## 4. Navigation
- [x] 4.1 Add "Posts" and "Garbage collection" entries to the Operations nav group (or a Maintenance subgroup).

## 5. Verify
- [x] 5.1 Fixtures exercise every new `ArtemisClient` method so both views render/operate offline.
- [x] 5.2 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all green.
- [x] 5.3 `openspec validate design-artemis-ui-maintenance --strict`.
- [x] 5.4 Browser smoke: delete→restore→purge a fixture post; dry-run then confirmed orphan sweep; purge-deleted.
