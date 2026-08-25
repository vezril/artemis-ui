# Change: design-artemis-ui-catalog-read

> **Design capture.** The first catalog slice for Artemis UI — the **read surface**: DSL search
> with grammar-aware autocomplete, a results gallery with keyset infinite scroll, and a single-post
> view. The start of the per-service replacement for Muses' catalog. Write surfaces (upload, tag
> edit, pools, review) follow as later changes.

## Why

The console can operate the service but can't yet see the catalog it holds. Browsing and searching
posts is the core of a Danbooru-style catalog and the thing an operator most often needs after the
ops views. Muses already proved this UX against the same Artemis API, so this change brings that
read surface into the per-service console — but wired to the **real** Artemis contract (Muses was
written against an assumed contract that differs in key ways; see Decisions).

## What Changes

- A **search** surface: a grammar-aware tag/metatag autocomplete input over
  `GET /tags/autocomplete`, driving a DSL query; category-colored suggestions; order control; a
  results **gallery** with keyset (`nextCursor`) infinite scroll over `GET /posts`, and a
  "tags in these results" facet strip over `GET /posts/facets`.
- A **post view**: a single post over `GET /posts/{id}` — the media (via the Artemis media gateway),
  a category-grouped tag sidebar, metadata (rating/score/dimensions/dates), and related links
  (parent/duplicate). Read-only in this slice (tag editing, favorite, score are the write slice).
- The `ArtemisClient` gains the catalog read methods (`searchPosts`, `getPost`, `facets`,
  `autocomplete`) in both fixture and http implementations, and the media-URL helper.
- The Catalog nav entries (Search, Gallery) become live.

## Capabilities

### New Capabilities
- `catalog-search`: the search input (DSL + autocomplete), order control, and the results gallery
  with keyset infinite scroll and the tags-in-results facets.
- `catalog-post`: the single-post read view (media, tag sidebar, metadata, relationships).

### Modified Capabilities
- (none — additive; app-shell nav just activates its Catalog entries.)

## Impact

- **Artemis API consumed:** `GET /posts?tags=&order=&cursor=&limit=`, `GET /posts/facets?tags=`,
  `GET /tags/autocomplete?q=&context=`, `GET /posts/{id}`, and media via `GET /media/{md5}/{variant}`.
- `ArtemisClient` and its fixture/http implementations gain the read methods + the catalog domain
  types (Post, PostSummary, Tag, SearchQuery, PostPage, Suggestion, …).
- Ports muses-ui's gallery/search/post components as the visual/interaction reference, re-wired to
  the real contract and the artemis-ui shell.

## Decisions (contract reconciliation — Muses was written against a different contract)

- **String post ids.** Artemis post ids are opaque strings (ULID-style), not numbers. All catalog
  types and routes here use `string` ids (Muses used `number` — that would not round-trip).
- **Keyset cursor, not page numbers.** `GET /posts` returns an opaque `nextCursor`; paging passes it
  back as `?cursor=` and must keep `order` stable across the sequence (the cursor re-derives it).
- **Real field names.** `PostSummary` = `{id, status, tags[], rating?, score, favCount, width?,
  height?, duration?, parent?, duplicateOf?, createdAt}`; autocomplete tag rows are **snake_case**
  (`post_count`, `alias_of`); metatag autocomplete returns a bare string array.
- **Media URLs** are `GET /media/{md5}/{variant}` (the gateway streams Apollo derivatives); the view
  needs the post's md5 + the derivative variant name (e.g. `thumb.webp`, `sample.webp`, `720p.mp4`).

## Non-goals / out of scope

- Write actions (tag edit, favorite, score, upload, pools, review) — the next catalog slices.
- Auth (single-user). Requires an Artemis release for live media; fixtures until then.
