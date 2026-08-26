# Design: design-artemis-ui-saved-searches

## Context

The Artemis surface is entity-backed (single-user list, read-your-writes, no projection):
`GET /saved-searches` lists `{name, query}`, `POST` saves, `PATCH /{name}` renames, `DELETE /{name}`
removes; `SearchName` = trimmed, non-empty, ≤128 chars; errors use the shared `{error}` envelope.
The search view already keeps its whole state in the URL (`/search?tags=&order=`).

## Decisions

### D1 — Run = navigate; the results endpoint stays unconsumed

Clicking a saved search navigates to `/search?tags=<encoded query>`. That reuses the ONE search
pipeline (gallery, facets, order control, keyset scroll) and keeps saved searches from growing a
parallel results path. `GET /saved-searches/{name}/results` remains an API convenience the UI
deliberately does not call — documented here so nobody "fixes" it later.

### D2 — Panel placement and shape

A `SavedSearches` client component at the top of the `/search` sidebar (above "Tags in results").
Rows: the name as a button (run), a pencil (inline rename form, Enter/escape), a two-step inline
delete (× → confirm/cancel — same lightweight confirm as the maintenance views, no dialog). Below
the list: **Save current search** — visible always, enabled only when `?tags=` is non-empty; opens
an inline name field; submit saves and clears. Errors (duplicate name, validation) render inline
`role="alert"`, attributed to the row/form that caused them.

### D3 — Hook: `["saved-searches"]`, optimistic rename/delete, plain save

`useSavedSearches()` — `useQuery` on `["saved-searches"]` (entity read; staleTime 30s like other
browse reads). Mutations in `useSavedSearchMutations()`:
- `save(name, query)` — no optimistic insert (the list is small and the entity is
  read-your-writes); onSettled invalidates. Errors surface to the save form.
- `rename(from, to)` / `remove(name)` — optimistic on the cached list (patch/filter), rollback on
  error, invalidate on settle. Serialized via a shared mutation `scope`
  (`saved-search-mutation`) so rapid rename+delete can't interleave; wire payloads are
  single-name intents, so replay-after-rollback is semantically safe (no reorder-style staleness).

### D4 — Client + fixtures

`SavedSearch {name, query}` type; client methods with `encodeURIComponent(name)` in paths (names
may contain spaces). http parsing: `{searches}` unwrap with the standard degrade-not-throw row
guard; writes via `expectOk` (server messages — duplicate/invalid name — pass through). Fixtures:
a mutable seeded list (two entries over fixture-relevant queries), duplicate-save rejected with a
409-style `ApiError`, rename/remove validate existence.

## Risks / Trade-offs

- **No optimistic save** trades a tick of latency for simplicity — acceptable: the entity answer
  is immediate at this scale.
- **Panel on desktop sidebar only** (the sidebar is `hidden lg:block`, like facets) — saved
  searches are a power feature; mobile parity can ride a later pass, same as facets.

## Open Questions

- (none)
