# Change: design-artemis-ui-saved-searches

> **Design capture.** Saved searches — named DSL queries you can re-run in one click — as the
> FINAL catalog slice. With this, the artemis-ui catalog surface is complete (search, post
> view/edit, upload, review, pools, find-similar, saved searches).

## Why

The DSL is powerful but perishable: a good query (`1girl cat_ears -monochrome order:score`) lives
only in the URL bar. Artemis has carried a complete saved-searches surface for months — an
event-sourced single-user list with save/list/rename/remove and a run endpoint — with zero
consumers. This closes the last catalog gap and seeds the documented growth path (saved search +
watermark ⇒ subscriptions/feeds, deferred).

## What Changes

- A **Saved searches panel** on `/search` (above "Tags in results"): the saved list, newest-first
  as served. Clicking an entry **runs it** by navigating to `/search?tags=<query>` — reusing the
  existing gallery, facets, ordering, and infinite scroll wholesale. Each entry offers inline
  **rename** and a two-step inline **delete**.
- A **Save current search** affordance in the panel, enabled when the current `?tags=` is
  non-empty: name it (validated non-empty, ≤128 chars — the server's `SearchName` rules) and save.
  A duplicate name surfaces the server's message inline.
- `ArtemisClient` gains `listSavedSearches`, `saveSearch(name, query)`,
  `renameSavedSearch(from, to)`, `deleteSavedSearch(name)`; fixtures seed two entries.
- **Intentionally NOT consumed:** `GET /saved-searches/{name}/results` — the UI runs a saved
  search through the normal `/search?tags=` flow (one search pipeline, facets included); the
  results endpoint remains an API-level convenience.

## Capabilities

### New Capabilities
- `catalog-saved-searches`: list/save/rename/delete named DSL queries from the search view;
  one-click re-run through the standard search flow.

### Modified Capabilities
- (none — additive; the panel mounts in the existing search sidebar.)

## Impact

- **Artemis API consumed** (all existing, entity-backed read-your-writes):
  `GET /saved-searches` → `{searches:[{name, query}]}`; `POST /saved-searches {name, query}` → 201;
  `PATCH /saved-searches/{name} {name: newName}` → 200; `DELETE /saved-searches/{name}` → 200.
  Names go in path segments → always `encodeURIComponent` (names may contain spaces).
- New `src/components/catalog/saved-searches.tsx`, hook `use-saved-searches.ts`
  (`["saved-searches"]` key; optimistic rename/delete with rollback; save invalidates).

## Non-goals / out of scope

- Watermarks / "new since last seen" badges (the subscriptions growth path — deferred by design).
- Sharing, ordering, or foldering of saved searches; saving the `order` alongside the query (the
  DSL itself can carry `order:` metatags when wanted).
