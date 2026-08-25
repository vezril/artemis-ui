# catalog-post Specification

## Purpose
TBD - created by archiving change design-artemis-ui-catalog-read. Update Purpose after archive.
## Requirements
### Requirement: Render a post from GET /posts/{id}

The post view MUST fetch `GET /posts/{id}` (string id) and render the media, its tags, and metadata
(status, rating, score, dimensions/duration, created date). A `404` renders a not-found state, not
a crash.

#### Scenario: Existing post
- **WHEN** a valid post id is opened
- **THEN** the media, tags, and metadata render

#### Scenario: Missing post
- **WHEN** the id does not exist (404)
- **THEN** a not-found state is shown

### Requirement: Media from the post's derivative refs

The view MUST build the media URL from the post's `md5` + a derivative `variant`, choosing a
suitable variant (the `sample` or original for images, the transcode for video), falling back to a
placeholder when no usable ref exists (e.g. fixtures).

#### Scenario: Media renders from a ref
- **WHEN** the post has `md5` and a usable derivative
- **THEN** the media element points at `<base>/media/<md5>/<variant>`

### Requirement: Category-grouped tag sidebar

The view MUST group the post's tags by category with the shared category colors (each paired with a
text label, never color-only), and each tag links to a search for that tag.

#### Scenario: Tag links to search
- **WHEN** a tag in the sidebar is clicked
- **THEN** the app navigates to a search for that tag

