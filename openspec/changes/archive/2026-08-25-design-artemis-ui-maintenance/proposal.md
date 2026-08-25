# Change: design-artemis-ui-maintenance

> **Design capture.** Extends the operations console with the **maintenance** surface — post
> deletion lifecycle and garbage collection — now that Artemis exposes the admin endpoints
> (`design-artemis-admin-api`). Reuses the shell, the `ArtemisClient` seam, and the confirm-gate
> pattern from `operations-reprocessing`.

## Why

The ops console can observe the service (health, metrics) and drive reprocessing, but it can't yet
perform the housekeeping the operator actually needs: soft-deleting a bad post, restoring one,
hard-purging storage, reclaiming failed-upload debris, or forcing a retention purge. Those
capabilities now exist over HTTP (Artemis admin API), so the console should drive them — with the
care destructive actions demand (purge and a real orphan-sweep permanently delete blobs).

## What Changes

- A **Posts** maintenance view: enter a post id and soft-delete it, restore a soft-deleted one, or
  hard-purge it. Purge (and delete) are **confirmed** before firing; the result reports the new
  status (or `{purged, blobsDeleted}`).
- A **Garbage collection** view: run the failed-upload **orphan sweep** — always **dry-run first**,
  showing `{scanned, orphans}`, with a separate explicit confirm to run the destructive sweep — and
  trigger an on-demand **retention purge** pass, reporting `{purged}`.
- Two new nav entries under Operations; the `ArtemisClient` gains the admin methods (fixtures + http).

## Capabilities

### New Capabilities
- `post-lifecycle`: a view to soft-delete / restore / hard-purge a post by id, with confirms on the
  destructive actions and clear result reporting.
- `gc-maintenance`: a view to run the orphan sweep (dry-run → confirmed real run) and an on-demand
  retention-purge pass, reporting the counts.

### Modified Capabilities
- (none — additive to the existing operations surface; the app-shell nav just gains two entries.)

## Impact

- **Artemis API consumed (new):** `DELETE /posts/{id}`, `POST /posts/{id}/restore`,
  `POST /posts/{id}/purge`, `POST /admin/gc/orphan-sweep` (`{dryRun}`), `POST /admin/gc/purge-deleted`.
  All unauthenticated.
- **`ArtemisClient`** gains `deletePost`, `restorePost`, `purgePost`, `orphanSweep`, `purgeDeleted`
  in both the fixture and http implementations.
- To drive a live service these need an Artemis release that includes the admin API; until then the
  views work against fixtures (and the connection indicator makes fixture mode explicit).

## Non-goals / out of scope

- Dedup admin (Artemis exposes no batch dedup surface — the per-post `duplicate_of` is a catalog
  concern, not maintenance).
- Bulk/selection deletion (single post by id for now); scheduling/automation of GC (Artemis owns the
  retention schedule; this is on-demand).
- Auth/authorization (single-user Artemis); undo of a purge (a purge is permanent by definition).
