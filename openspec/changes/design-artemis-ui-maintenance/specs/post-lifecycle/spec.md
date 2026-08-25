# post-lifecycle

A console view to soft-delete, restore, and hard-purge a single post by id, over the Artemis
admin-deletion endpoints.

## ADDED Requirements

### Requirement: Soft-delete a post by id

The view MUST let the operator enter a post id and soft-delete it via `DELETE /posts/{id}`,
gated behind an explicit confirm (soft-delete hides the post from default browse/search). On
success it reports the resulting status (`deleted`); an unknown id surfaces the `404 {error}`
inline.

#### Scenario: Confirmed soft-delete
- **WHEN** the operator enters a valid post id and confirms delete
- **THEN** the console calls `DELETE /posts/{id}` and reports status `deleted`

#### Scenario: Unknown post
- **WHEN** the id does not exist
- **THEN** the `404` error message is shown inline and no status change is reported

### Requirement: Restore a soft-deleted post

The view MUST let the operator restore a soft-deleted post via `POST /posts/{id}/restore`.
Restore is non-destructive and submits directly (no confirm). On success it reports status
`active`.

#### Scenario: Restore
- **WHEN** the operator restores a soft-deleted post
- **THEN** the console calls `POST /posts/{id}/restore` and reports status `active`

### Requirement: Hard-purge a post

The view MUST let the operator hard-purge a soft-deleted post via `POST /posts/{id}/purge`,
gated behind an explicit confirm that states the action is permanent (it deletes the post's
blobs). On success it reports `{purged, blobsDeleted}`; a post that was not purged (e.g. no
longer deleted) is reported as `purged:false` without implying an error.

#### Scenario: Confirmed purge
- **WHEN** the operator confirms a purge of a soft-deleted post
- **THEN** the console calls `POST /posts/{id}/purge` and reports `purged:true` with the blob count

#### Scenario: Nothing to purge
- **WHEN** the post is not currently soft-deleted
- **THEN** the result is reported as `purged:false, blobsDeleted:0`, not an error
