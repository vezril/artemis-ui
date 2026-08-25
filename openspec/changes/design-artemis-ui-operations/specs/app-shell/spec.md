# app-shell

The console layout, navigation, Artemis connection indicator, theming, and the typed
`ArtemisClient` fixtures↔live seam that every view builds on.

## ADDED Requirements

### Requirement: Console layout with Operations and Catalog navigation

The app MUST render a persistent shell — a header and a left navigation — around every route.
Navigation is grouped into an **Operations** section (Health, Metrics, Reprocess) and a
**Catalog** section (Search, Uploads, Pools, Review, …). Catalog entries whose capabilities
are not yet built render as disabled "coming soon" items so the eventual shape is visible
without leading anywhere broken.

#### Scenario: The shell wraps every route
- **WHEN** any route renders
- **THEN** the header and left navigation are present, and the active nav item reflects the
  current route

#### Scenario: Unbuilt catalog entries are visibly disabled
- **WHEN** a Catalog capability has not yet been implemented
- **THEN** its nav entry is shown but disabled (not a dead link) and labeled as coming soon

### Requirement: Artemis connection indicator

The header MUST show which Artemis the console is pointed at and whether it is reachable. When
`NEXT_PUBLIC_ARTEMIS_BASE_URL` is set, it shows the base URL and a live/down status derived
from health. When it is unset, it states plainly that the console is running on **fixtures**
so mock data is never mistaken for a live service.

#### Scenario: Live target
- **WHEN** `NEXT_PUBLIC_ARTEMIS_BASE_URL` is set and Artemis is reachable
- **THEN** the header shows the base URL and a live indicator

#### Scenario: Fixture mode is explicit
- **WHEN** `NEXT_PUBLIC_ARTEMIS_BASE_URL` is unset
- **THEN** the header explicitly indicates fixtures/mock mode, not a live connection

### Requirement: Typed ArtemisClient seam

A single typed `ArtemisClient` interface MUST expose the operations the UI needs. Two
implementations exist: a `fixtureClient` (default) returning representative mock data, and an
`httpClient(baseUrl)` calling the real Artemis. A selector chooses `httpClient` when
`NEXT_PUBLIC_ARTEMIS_BASE_URL` is set, else `fixtureClient`. The UI depends only on the
interface, never on a concrete implementation.

#### Scenario: Selector honors the env
- **WHEN** the client is constructed
- **THEN** it is the http client if `NEXT_PUBLIC_ARTEMIS_BASE_URL` is set, otherwise the
  fixture client

#### Scenario: Views are implementation-agnostic
- **WHEN** a view calls an `ArtemisClient` method
- **THEN** it behaves identically against fixtures and http, differing only in the data
  returned

### Requirement: Dark, accessible theming

The console MUST be dark by default using the shared design tokens. Any category/status color is
always paired with a text label (never color-only), so state is legible without relying on
color perception.

#### Scenario: Status is never color-only
- **WHEN** a status is shown by color (e.g. up/down)
- **THEN** it is accompanied by a text label conveying the same state
