## Context

The console has operations + maintenance; this adds the first catalog surface: the read side
(search + gallery + single-post view). Artemis now exposes media refs on its read API
(`read-media-refs`), so a client can build media-gateway URLs. Muses proved this UX against the
same API and its components are the visual/interaction reference — but Muses was written against a
different assumed contract (numeric ids, page numbers), so this is a reconciled build, not a copy.

## Goals / Non-Goals

**Goals:** grammar-aware DSL search with autocomplete; a results gallery with keyset infinite
scroll and real thumbnails (from the new media refs); a single-post read view with the media, a
category-grouped tag sidebar, and metadata.

**Non-Goals:** any write action (tag edit, favorite, score, upload, pools, review) — later slices;
auth; a live service (fixtures until an Artemis release ships the read-media-refs + admin API).

## Decisions

- **String ids everywhere.** Post ids are opaque strings; the catalog types/routes use `string`
  (Muses used `number`). `/posts/[id]` is a string route param.
- **Keyset pagination via TanStack `useInfiniteQuery`.** `GET /posts` returns `nextCursor`;
  `getNextPageParam` = `nextCursor`; `order` is fixed for a query sequence (the cursor re-derives
  it). No page numbers, no offset.
- **Media URLs from the new refs.** A post/summary carries `md5` + `derivatives: [{kind, variant}]`;
  the client builds `<base>/media/<md5>/<variant>`. A `mediaUrl(md5, variant)` helper resolves the
  base (the http client's base, or a same-origin `/media/...` proxy note for fixtures). Thumbnail =
  the `thumbnail` derivative (fallback `sample`); the post view prefers `sample`/original per media
  type. In fixture mode there are no real blobs, so tiles render a labelled placeholder.
- **Autocomplete matches the real contract.** `GET /tags/autocomplete?q=&context=tag|metatag` — tag
  rows are snake_case (`post_count`, `alias_of`); metatag context returns a bare string array. The
  input parses the current DSL term to decide context (a `:` → metatag) and category-colors tag
  suggestions.
- **Reuse the app-shell + tag palette.** The gallery/search/post components adopt artemis-ui's shell
  and the existing category color tokens; the Catalog nav entries (Search, Gallery) go live and
  point at the new routes.

## Risks / Trade-offs

- **Fixtures can't show real media.** Without a live Artemis + Apollo, tiles/viewer show
  placeholders keyed on md5/variant; the connection indicator keeps fixture mode explicit. The URL
  construction is still exercised (and unit-tested) so it's correct once pointed at a live service.
- **Contract drift risk.** Muses' component logic assumes fields this build must remap; the reconcile
  is concentrated in the API layer (types + http client), so components depend only on the corrected
  domain types.
- **Autocomplete DSL parsing** is a small grammar; edge cases (multiple terms, quotes, `~`/`-`
  prefixes) are handled by parsing only the token under the cursor, mirroring Muses.
