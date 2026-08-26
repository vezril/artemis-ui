# catalog-saved-searches

Named DSL queries: save the current search, list, re-run in one click through the normal search
flow, rename, delete.

## ADDED Requirements

### Requirement: List and run saved searches

The search view MUST show the saved searches from `GET /saved-searches`. Activating an entry MUST
run it by navigating to `/search?tags=<encoded query>` — through the standard search pipeline
(gallery, facets, ordering), not a parallel results path.

#### Scenario: Run a saved search
- **WHEN** the user activates a saved search whose query is `1girl cat_ears`
- **THEN** the view navigates to the search URL carrying that query and the normal search renders its results

#### Scenario: Empty state
- **WHEN** no searches are saved
- **THEN** the panel shows a designed empty hint (not a blank region)

### Requirement: Save the current search

The panel MUST offer saving the current query under a user-chosen name (trimmed, non-empty,
≤128 chars), enabled only when the current query is non-empty. Server rejections (duplicate or
invalid name) surface inline as attributed errors; success adds the entry to the list.

#### Scenario: Save succeeds
- **WHEN** the user names the current non-empty query and submits
- **THEN** `POST /saved-searches` is called with `{name, query}` and the new entry appears in the list

#### Scenario: Edge case — duplicate name is an inline error
- **WHEN** the server rejects the save with its error message
- **THEN** the message renders inline (`role="alert"`) and the form stays open with the input preserved

### Requirement: Rename and delete

Each entry MUST support inline rename (`PATCH /saved-searches/{name}` with the new name) and a
two-step inline delete (`DELETE /saved-searches/{name}`). Both apply optimistically with rollback
on error; names are URL-encoded in paths (names may contain spaces).

#### Scenario: Rename applies optimistically
- **WHEN** the user renames an entry
- **THEN** the list shows the new name immediately and keeps it on success; on failure the old name returns with an error shown

#### Scenario: Delete is two-step
- **WHEN** the user presses delete on an entry
- **THEN** nothing is removed until the inline confirm is activated; confirming removes the entry optimistically
