# metrics-dashboard Specification

## Purpose
TBD - created by archiving change design-artemis-ui-operations. Update Purpose after archive.
## Requirements
### Requirement: Parse Prometheus text exposition client-side

The dashboard MUST fetch `GET /metrics` (`text/plain`) and parse the exposition format into
samples of `{name, labels, value}` (plus optional HELP/TYPE metadata) in the browser. The
parser is defensive: a line it cannot understand is skipped, never fatal, so one malformed
line does not blank the dashboard.

#### Scenario: Well-formed exposition parses
- **WHEN** `/metrics` returns valid exposition with HELP/TYPE and sample lines
- **THEN** each sample is parsed into name, labels, and numeric value, and HELP/TYPE is
  associated with its metric

#### Scenario: Malformed line is tolerated
- **WHEN** a single sample line is unparseable (e.g. an unexpected token)
- **THEN** that line is skipped and the rest of the exposition still renders

#### Scenario: Special values
- **WHEN** a value is `NaN`, `+Inf`, or `-Inf`
- **THEN** the parser represents it without throwing, and the UI renders it legibly

### Requirement: Curated Artemis signal cards

A curated set of Artemis signals MUST be shown as titled cards — e.g. JVM/process, HTTP
request rate/latency, projection lag, Hermes consume/publish, entity activity — each with the
current value and a small in-page sparkline built from successive polls. A card whose metric
is absent degrades to a "no data" state rather than disappearing.

#### Scenario: Known signal renders as a card
- **WHEN** a curated metric is present in the exposition
- **THEN** its card shows the current value (and unit/label) and a sparkline over the polling
  window

#### Scenario: Missing metric degrades gracefully
- **WHEN** a curated metric is absent from the exposition
- **THEN** its card shows "no data" and the rest of the dashboard is unaffected

### Requirement: Raw metrics escape hatch

Beyond the curated cards, a raw view MUST list all parsed samples (searchable/filterable) so no
metric is hidden if it is not in the curated set.

#### Scenario: Everything is browsable
- **WHEN** the operator opens the raw metrics view
- **THEN** all parsed samples are listed and can be filtered by name/label

### Requirement: Auto-refresh

Metrics MUST poll on an interval (~10s), pausable, so the dashboard reflects the live service
without a manual reload; sparklines accumulate across polls.

#### Scenario: Periodic refresh
- **WHEN** the dashboard is open and refresh is enabled
- **THEN** it re-fetches `/metrics` on the interval and updates cards and sparklines

