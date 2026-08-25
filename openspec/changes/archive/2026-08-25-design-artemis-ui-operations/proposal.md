# Change: design-artemis-ui-operations

> **Design capture.** The first slice of Artemis UI — the **operations console** and the
> app shell that hosts it. Ops-first; the catalog surfaces (search, post, upload, tags,
> pools, saved searches, review) land in later changes.

## Why

Artemis is operated blind today: to know whether it is up, how the read-model projection is
keeping up, or whether an ingest backlog is draining, you read logs or curl `/metrics` by
hand. And when derivatives, metadata, or tags need a backfill, `POST /reprocess` is a raw
curl with a hand-built DSL selection — easy to fire too broadly. A per-service console gives
the operator a single place to see liveness + the key service metrics and to trigger a
reprocess with the selection made visible and confirmed before it enqueues.

This change also lays the **app shell** every later catalog surface reuses (nav, the
Artemis connection/base-URL indicator, the fixtures↔live client seam, the dark theme), so
it is the natural foundation to build first.

## What Changes

- A console **app shell**: a left nav split into **Operations** and **Catalog** sections
  (Catalog entries arrive disabled/"coming soon" until their changes land), a header showing
  which Artemis the console is pointed at (base URL) and its liveness, and the typed
  `ArtemisClient` seam (`fixtureClient` by default, `httpClient` when
  `NEXT_PUBLIC_ARTEMIS_BASE_URL` is set).
- A **health** view over `GET /health`: UP/DOWN, service, version, polled; a clear DOWN
  banner when readiness is withdrawn (503).
- A **metrics dashboard** that parses Artemis's Prometheus exposition (`GET /metrics`,
  `text/plain`) client-side into labeled series, and surfaces the key Artemis signals
  (JVM/process, HTTP, projection lag, Hermes consume/publish, entity activity) as cards +
  small time-series, auto-refreshing.
- A **reprocessing** action over `POST /reprocess`: choose a selection (`stale`, a single
  `id:<x>`, or a search-DSL query) and a `kind` (`derivatives | metadata | tags`), preview
  the selection, confirm, and report the `{enqueued}` count; guard a broad DSL selection
  behind an explicit confirm.

## Capabilities

### New Capabilities
- `app-shell`: the console layout, Operations/Catalog navigation, the Artemis connection
  indicator (base URL + liveness), theming, and the `ArtemisClient` fixtures↔live seam.
- `service-health`: liveness/readiness view over `GET /health` (status, service, version,
  polling, DOWN surfacing).
- `metrics-dashboard`: client-side Prometheus-text parsing and a refreshing dashboard of the
  key Artemis service metrics from `GET /metrics`.
- `operations-reprocessing`: trigger and report `POST /reprocess` with a previewed,
  confirmed selection + kind.

### Modified Capabilities
- (none — new repo, no existing living specs.)

## Impact

- **New repo** `artemis-ui` (scaffolded): Next.js 15 / React 19 / Tailwind 4 / shadcn /
  TanStack Query. Adds an `ArtemisClient` interface + fixture and http implementations in
  `src/lib/api`, mirroring muses-ui's seam.
- **Artemis API consumed:** `GET /health`, `GET /metrics`, `POST /reprocess`. All
  unauthenticated. Responses carry a server-minted `X-Correlation-Id` (read-only to the UI).
- **Dependency:** a client-side Prometheus text-exposition parser (small, hand-rolled — no
  server component; keeps the standalone image lean).

## Non-goals / out of scope (this change)

- **Garbage collection, orphan sweep, purge, dedup admin, and post deletion have no HTTP
  surface in Artemis today** (they are internal/scheduled — the `deletion-lifecycle` and
  `dedup-and-gc` capabilities run inside the service). The console cannot drive them until
  Artemis exposes admin endpoints; that would be a future **Artemis** design change, and a
  corresponding UI change here. Flagged, not built.
- All catalog surfaces (search/DSL, post view, uploads, tag editing, pools, saved searches,
  auto-tag review). These are separate later changes that reuse this shell and, where
  sensible, port muses-ui's proven components.
- Auth/multi-user (Artemis is single-user, no auth); metric alerting/history beyond the
  in-page refresh window; Grafana-style dashboards (Codex owns the Prometheus/Grafana stack).
