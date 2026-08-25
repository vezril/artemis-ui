## Context

Artemis UI is a new per-service Next.js console (scaffolded: Next 15 App Router / React 19 /
Tailwind 4 / shadcn / TanStack Query). This first change builds the **app shell** and the
**operations** surface. Artemis exposes an unauthenticated REST API; the three operational
endpoints are `GET /health`, `GET /metrics` (Prometheus text), and `POST /reprocess`. The UI
talks REST/JSON only and reads media (later) as HTTP URLs from the Artemis media gateway.

muses-ui is the proven template for the client seam: a typed `ArtemisClient` interface with a
`fixtureClient` (default, so the app builds/runs before a live Artemis) and an
`httpClient(baseUrl)` selected by `NEXT_PUBLIC_ARTEMIS_BASE_URL`. This console reuses that
shape but with an operations-first client.

## Goals / Non-Goals

**Goals:**
- A console shell with Operations + Catalog nav, an Artemis connection indicator (base URL +
  live/down), dark theme, and the fixtures↔live client seam — reused by every later change.
- See liveness (`/health`) and the key service metrics (`/metrics`) without leaving the app.
- Trigger a reprocess with the selection made explicit and confirmed, and see what enqueued.

**Non-Goals:**
- GC / orphan-sweep / purge / dedup admin / post deletion — **not exposed over HTTP by
  Artemis** (internal/scheduled). Out of scope until Artemis adds admin endpoints.
- Catalog surfaces (separate later changes), auth, and long-horizon metric history/alerting
  (Codex owns the Prometheus/Grafana stack; this dashboard is an at-a-glance operator view).

## Decisions

- **Client-side Prometheus parsing, no server component.** `GET /metrics` returns text
  exposition. A small hand-rolled parser (HELP/TYPE/sample lines → `{name, labels, value}`)
  turns it into series in the browser. Keeps the image a static standalone bundle (no API
  routes, no server-side scrape state) and avoids a charting/observability dependency beyond
  a light SVG sparkline. Rationale: the payload is small and single-instance; a full
  time-series store is Grafana's job, not this console's.
- **Metrics are curated, not dumped.** The dashboard surfaces a known set of Artemis signals
  as titled cards (with the raw series available), rather than rendering every metric — an
  operator wants "is the projection lagging / is the ingest backlog draining", not a 500-row
  table. Unknown metrics are still browsable in a raw view so nothing is hidden.
- **Reprocess is a two-step, confirmed action.** The form builds `{select, kind}`; a broad
  selection (`stale` or a DSL query, vs a single `id:<x>`) requires an explicit confirm step
  before the POST, because a reprocess enqueues real work across the fleet. The result shows
  the `{enqueued}` count; a `400` (bad DSL/kind) surfaces the server's `{error}` inline.
- **Polling, not sockets.** Health and metrics refresh on a TanStack Query interval
  (health ~5s, metrics ~10s, both pausable). Artemis has no streaming endpoint and the
  operator view is glanceable; polling is sufficient and simple.
- **Connection indicator is honest about fixtures.** When `NEXT_PUBLIC_ARTEMIS_BASE_URL` is
  unset the header says "fixtures" (not a fake green dot), so an operator never mistakes mock
  data for a live service.

## Risks / Trade-offs

- **Prometheus format drift.** A hand-rolled parser can miss exotic exposition (exemplars,
  `NaN`/`+Inf`, escaped label values). Mitigation: parse defensively, tolerate/skip lines it
  can't read (never throw the dashboard away over one bad line), and keep the raw-metrics
  view as the escape hatch. Covered by parser unit tests over real Artemis output samples.
- **Curated metric names may lag Artemis.** If Artemis renames/removes a metric, a card goes
  empty. Mitigation: cards degrade to "no data" individually; the raw view always reflects
  reality; the curated set is a small, easily-updated map.
- **Reprocess blast radius.** A DSL selection could match a huge set. The UI can preview the
  selection's match count via a `GET /posts` search with the same query before enqueuing, and
  gates the POST behind confirm — but Artemis owns the real guardrails; the UI is a safety
  layer, not the enforcement point.
- **No auth.** Anyone who can reach the console can trigger a reprocess. Accepted at
  single-user homelab scale; when Artemis gains auth, the console adds it (additive).
