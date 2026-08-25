# catalog-search

The search surface: a DSL input with grammar-aware autocomplete, an order control, and a results
gallery with keyset infinite scroll and tags-in-results facets.

## ADDED Requirements

### Requirement: DSL search drives a keyset-paginated gallery

The search view MUST run `GET /posts?tags=<DSL>&order=&cursor=&limit=` and render the results as a
gallery, loading further pages by passing the returned `nextCursor` back as `?cursor=` (keyset, not
offset), keeping `order` fixed across the sequence. Infinite scroll loads the next page as the user
nears the end; a null `nextCursor` ends the list.

#### Scenario: First page and continuation
- **WHEN** a query is run
- **THEN** the first page renders and, on scrolling near the end, the next page loads via the
  previous response's `nextCursor`

#### Scenario: End of results
- **WHEN** the response has a null `nextCursor`
- **THEN** no further page is requested and an end-of-results state is shown

### Requirement: Grammar-aware tag autocomplete

The search input MUST offer completions from `GET /tags/autocomplete` for the term under the cursor:
tag context (default) shows category-colored tag rows with their post counts and alias hints
(snake_case `post_count`/`alias_of`); a term containing `:` uses metatag context (a bare
completion list). Selecting a completion replaces only the active term.

#### Scenario: Tag completion
- **WHEN** the active term is a partial tag
- **THEN** category-colored tag suggestions with counts are offered, and selecting one replaces that
  term

#### Scenario: Metatag completion
- **WHEN** the active term contains `:`
- **THEN** metatag-context completions are offered

### Requirement: Results carry real thumbnails

Each result tile MUST build its thumbnail URL from the summary's `md5` + a derivative `variant`
(`<base>/media/<md5>/<variant>`), preferring the `thumbnail` derivative. A summary without a usable
media ref renders a labelled placeholder rather than a broken image.

#### Scenario: Tile with media
- **WHEN** a summary has `md5` and a `thumbnail` derivative
- **THEN** the tile shows the media-gateway thumbnail URL

#### Scenario: Tile without media
- **WHEN** a summary has no usable media ref (e.g. pending, or fixtures)
- **THEN** the tile shows a placeholder, not a broken image

### Requirement: Tags-in-results facets

The view MUST show the tags present in the current result set via `GET /posts/facets?tags=<DSL>`,
grouped by category, each clickable to refine the query.

#### Scenario: Facet refine
- **WHEN** the results facets are shown and a tag is clicked
- **THEN** that tag is added to the query and the gallery re-runs
