# gc-maintenance Specification

## Purpose
TBD - created by archiving change design-artemis-ui-maintenance. Update Purpose after archive.
## Requirements
### Requirement: Orphan sweep is dry-run first

The view MUST require a dry-run before a real orphan sweep: running the sweep first calls
`POST /admin/gc/orphan-sweep {dryRun:true}` and shows `{scanned, orphans}`; only after a dry-run
result is shown is a separate, explicitly-confirmed destructive run
(`POST /admin/gc/orphan-sweep {dryRun:false}`) offered. The destructive run reports `{deleted}`.

#### Scenario: Dry-run preview
- **WHEN** the operator runs the orphan sweep
- **THEN** the console calls it with `dryRun:true` and shows the scanned and orphan counts, deleting
  nothing

#### Scenario: Confirmed real sweep
- **WHEN** the operator confirms a real run after seeing a dry-run
- **THEN** the console calls it with `dryRun:false` and reports how many blobs were deleted

#### Scenario: A real run is not offered before a dry-run
- **WHEN** no dry-run has been run yet
- **THEN** the destructive real-run action is not available

### Requirement: On-demand retention purge

The view MUST let the operator run one retention purge pass via `POST /admin/gc/purge-deleted`,
gated behind a confirm (it permanently purges posts already past the retention window). On success
it reports the `{purged}` count.

#### Scenario: Confirmed purge-deleted
- **WHEN** the operator confirms a retention purge pass
- **THEN** the console calls `POST /admin/gc/purge-deleted` and reports the number of posts purged

### Requirement: Report GC failures inline

The view MUST surface a failed GC call (a `5xx` or an error body) inline without losing the view
state, so a transient failure can be retried.

#### Scenario: A failed sweep is shown, not swallowed
- **WHEN** an orphan sweep or purge call fails
- **THEN** the error is shown inline and the operator can retry

