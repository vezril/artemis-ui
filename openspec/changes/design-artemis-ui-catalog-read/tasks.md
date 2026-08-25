# Tasks — design-artemis-ui-catalog-read

## 1. Catalog domain types + API client (reconciled to the real contract)
- [x] 1.1 `types.ts`: add catalog types — `Rating`, `PostSummary` (string id, md5?, derivatives[{kind,variant}], tags[], rating?, score, favCount, width?, height?, duration?, parent?, duplicateOf?, createdAt, status), `Post` (PostResponse: + favorited, source?, filetype?), `PostPage {posts, nextCursor?}`, `SearchQuery {tags, order?, cursor?, limit?}`, `OrderKey`, `Facets`, `Suggestion` (tag row snake_case + metatag string), `AutocompleteContext`, `DerivativeRef`.
- [x] 1.2 `client.ts`: add `searchPosts(q)`, `getPost(id: string)`, `facets(tags)`, `autocomplete(q, context)`.
- [x] 1.3 `http.ts`: implement against `GET /posts`, `GET /posts/{id}`, `GET /posts/facets`, `GET /tags/autocomplete`; keyset cursor; snake_case autocomplete rows; shape validation.
- [x] 1.4 `fixtures.ts`: implement with a small in-memory post set (string ids, believable derivatives) so search/gallery/post render offline.
- [x] 1.5 `media.ts`: `mediaUrl(md5, variant)` + `thumbnailOf(summary)`/`viewVariantOf(post)` helpers (+ unit tests).

## 2. Search + gallery (catalog-search)
- [x] 2.1 `/search` route + search box with grammar-aware autocomplete (term-under-cursor, tag vs metatag context, category colors, counts/alias).
- [x] 2.2 Order control; results gallery via `useInfiniteQuery` (keyset `nextCursor`), skeletons, end-of-results.
- [x] 2.3 Post tiles: thumbnail from media refs (placeholder fallback); link to `/posts/{id}`.
- [x] 2.4 Tags-in-results facet strip from `GET /posts/facets`, category-grouped, click-to-refine.

## 3. Post view (catalog-post)
- [x] 3.1 `/posts/[id]` route + post view: media (from derivative refs, placeholder fallback), metadata, 404 state.
- [x] 3.2 Category-grouped tag sidebar (shared colors + text labels), each tag links to `/search`.

## 4. Navigation
- [x] 4.1 Activate the Catalog nav entries (Search, Gallery) → the new routes; remove their "coming soon".

## 5. Verify
- [x] 5.1 Fixtures exercise every new client method; media-URL helpers unit-tested.
- [x] 5.2 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` green.
- [x] 5.3 `openspec validate design-artemis-ui-catalog-read --strict`.
- [x] 5.4 Browser smoke: search → gallery → open a post → click a tag → new search.
