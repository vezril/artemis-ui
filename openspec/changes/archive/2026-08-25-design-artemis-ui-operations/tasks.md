# Tasks — design-artemis-ui-operations

## 1. ArtemisClient seam (ops endpoints)
- [x] 1.1 `src/lib/api/types.ts`: `Health`, `MetricSample`/`ParsedMetrics`, `ReprocessRequest`, `ReprocessResult` types matching the Artemis contract.
- [x] 1.2 `src/lib/api/client.ts`: `ArtemisClient` interface — `getHealth()`, `getMetricsText()`, `reprocess(req)` (+ a `previewSelectionCount(dsl)` helper over `GET /posts`).
- [x] 1.3 `src/lib/api/http.ts`: `httpClient(baseUrl)` calling `GET /health`, `GET /metrics` (text), `POST /reprocess`; JSON + text handling; surface `{error}` on non-2xx.
- [x] 1.4 `src/lib/api/fixtures.ts`: `fixtureClient()` returning representative health, a realistic Prometheus exposition sample, and a fake reprocess result.
- [x] 1.5 `src/lib/api/index.ts`: selector — `httpClient` when `NEXT_PUBLIC_ARTEMIS_BASE_URL` is set, else `fixtureClient`.

## 2. App shell
- [x] 2.1 `src/components/shell/*`: header + left nav grouped Operations (Health, Metrics, Reprocess) / Catalog (disabled "coming soon" entries); active-route highlight.
- [x] 2.2 Connection indicator: base URL + live/down/unreachable, or explicit "fixtures" when the env is unset; driven by the health query.
- [x] 2.3 Wire the shell into `src/app/layout.tsx`; add routes `/health`, `/metrics`, `/reprocess`; make `/` redirect to `/health`.

## 3. service-health
- [x] 3.1 `useHealth` query hook (~5s poll, pausable) distinguishing `503` DOWN from transport-unreachable.
- [x] 3.2 Health view: UP/DOWN (+text label), service, version, DOWN banner, unreachable state.
- [x] 3.3 Feed the latest health into the header connection indicator.

## 4. metrics-dashboard
- [x] 4.1 `src/lib/metrics/prom-parse.ts`: defensive Prometheus text parser → `{name, labels, value, help?, type?}`; tolerate bad lines, `NaN`/`±Inf`.
- [x] 4.2 Curated Artemis signal map (name → {title, unit, group}); `useMetrics` query hook (~10s poll, pausable) accumulating a sparkline window.
- [x] 4.3 Dashboard: curated cards (value + sparkline), "no data" degradation, grouped layout.
- [x] 4.4 Raw metrics view: searchable/filterable table of all parsed samples.

## 5. operations-reprocessing
- [x] 5.1 Reprocess form: selection mode (one post `id:<x>` / stale / DSL query) + `kind` (derivatives|metadata|tags); validate a kind is chosen.
- [x] 5.2 Confirm step for broad selections (stale/DSL) with a match-count preview via `GET /posts`; single-post submits directly.
- [x] 5.3 Submit `POST /reprocess`; report `{enqueued}`; surface `400 {error}` inline preserving input.

## 6. Verify
- [x] 6.1 Unit tests for the Prometheus parser over real Artemis `/metrics` samples (incl. malformed line, `NaN`/`Inf`, labeled series).
- [x] 6.2 Fixtures exercise every `ArtemisClient` method so the whole console renders offline.
- [x] 6.3 `npm run lint`, `npm run typecheck`, `npm run build` all green.
- [x] 6.4 `openspec validate design-artemis-ui-operations --strict`.
