## Context

The operations console (`design-artemis-ui-operations`) shipped health, metrics, and reprocessing,
plus the app-shell and the typed `ArtemisClient` fixtures↔live seam. Artemis now exposes an admin
API (`design-artemis-admin-api`) for the deletion lifecycle and GC. This change adds the console
views that drive it, reusing the shell, the client seam, and the confirm-gate UX already
established for a broad reprocess.

## Goals / Non-Goals

**Goals:**
- Let the operator soft-delete / restore / hard-purge a single post by id from the console.
- Let the operator run the orphan sweep safely (dry-run first) and an on-demand retention purge.
- Make every destructive action explicit and confirmed; report concrete result counts.

**Non-Goals:**
- Bulk deletion, dedup admin, GC scheduling, auth, or undo of a purge (see proposal Non-goals).

## Decisions

- **Dry-run-first for the orphan sweep is enforced in the UI, not just available.** The sweep view
  runs `POST /admin/gc/orphan-sweep {dryRun:true}` to preview `{scanned, orphans}`; the real
  (`dryRun:false`) run is a *separate*, explicitly-confirmed action that is only offered after a
  dry-run has been seen. The server already defaults a missing/malformed body to dry-run — the UI
  adds the "you must look before you delete" workflow on top.
- **Purge and soft-delete are confirmed; restore is not.** Purge permanently deletes blobs and
  soft-delete hides a post, so both gate behind a confirm (mirroring the reprocess confirm panel).
  Restore is non-destructive and submits directly.
- **Reuse the `ArtemisClient` seam.** The five admin methods are added to the interface and to both
  implementations; the fixture client keeps a tiny in-memory notion of a few post statuses so
  delete→restore→purge produce believable transitions offline.
- **One request per action, result-reporting inline.** No optimistic UI — these are rare, weighty
  operations; show a spinner, then the concrete outcome (`status`, `{purged, blobsDeleted}`,
  `{scanned, orphans, deleted}`, `{purged}`), and surface a `404`/`400`/`5xx` `{error}` inline.

## Risks / Trade-offs

- **Destructive actions with no auth.** Anyone who can reach the console can purge a post or sweep
  storage. Accepted at single-user homelab scale (same posture as reprocess); the confirm gates are
  the safety layer. When Artemis gains auth, the console adds it.
- **Fixture vs live divergence.** The fixture client can only approximate Artemis's real
  delete/restore/purge state machine; it is for building/observing the UI, not a behavioral spec.
  The connection indicator keeps fixture mode explicit so counts are never mistaken for live.
- **No total count for the orphan sweep preview.** `{scanned, orphans}` from a dry-run is the real
  preview (server-computed), so this is accurate — unlike the reprocess DSL preview which is only a
  first-page lower bound.
