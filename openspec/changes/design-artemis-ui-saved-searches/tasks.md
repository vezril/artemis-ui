# Tasks: design-artemis-ui-saved-searches

## 1. API client

- [x] 1.1 `SavedSearch {name, query}` in types; `ArtemisClient`: `listSavedSearches()`,
  `saveSearch(name, query)`, `renameSavedSearch(from, to)`, `deleteSavedSearch(name)`.
- [x] 1.2 http impls: `{searches}` unwrap with degrade-not-throw row guard; writes via `expectOk`;
  `encodeURIComponent(name)` in every path.
- [x] 1.3 Fixtures: mutable seeded list (2 entries); duplicate save → `ApiError` 409-style;
  rename/remove validate existence.
- [x] 1.4 Contract tests: URL/body shapes (incl. a name with a space), envelope unwrap, error
  passthrough, fixture parity round-trip.

## 2. Hook (`use-saved-searches.ts`)

- [x] 2.1 `useSavedSearches()` on `["saved-searches"]` (staleTime 30s).
- [x] 2.2 `useSavedSearchMutations()`: `save` (invalidate only), `rename`/`remove` (optimistic
  list patch, rollback, invalidate; shared mutation `scope`).

## 3. Panel (`src/components/catalog/saved-searches.tsx`)

- [x] 3.1 List rows: name button → `router.push("/search?tags=" + encodeURIComponent(query))`;
  pencil → inline rename (Enter commits, Escape cancels); × → two-step inline delete.
- [x] 3.2 Save current search: enabled when `?tags=` non-empty; inline name field; inline
  `role="alert"` errors (duplicate/invalid); success clears + closes.
- [x] 3.3 Mount at the top of the `/search` sidebar (above "Tags in results"); designed empty
  state.
- [x] 3.4 Component tests: run navigates with the encoded query; save flow incl. duplicate error;
  optimistic rename + rollback on failure; two-step delete; empty state.

## 4. Verification

- [x] 4.1 Full gate: lint, typecheck, vitest, `next build`.
- [ ] 4.2 Frontend-review subagent pass; apply should-fixes.
- [x] 4.3 Browser smoke on fixtures: list renders → run applies query → save current → rename →
  delete (two-step) → empty state.
- [x] 4.4 `openspec validate design-artemis-ui-saved-searches --strict` clean.
