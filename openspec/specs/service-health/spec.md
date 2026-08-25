# service-health Specification

## Purpose
TBD - created by archiving change design-artemis-ui-operations. Update Purpose after archive.
## Requirements
### Requirement: Show Artemis liveness, service, and version

The Health view MUST call `GET /health` and show the reported `status` (UP/DOWN), `service`,
and `version`. The status is presented with both a color and a text label.

#### Scenario: Healthy service
- **WHEN** `GET /health` returns `200` with `{"status":"UP", ...}`
- **THEN** the view shows an UP state with the service name and version

#### Scenario: Service reports DOWN
- **WHEN** `GET /health` returns `503` with `{"status":"DOWN", ...}` (readiness withdrawn)
- **THEN** the view shows a prominent DOWN banner, still surfacing service and version if present

### Requirement: Poll health and surface unreachability

Health MUST be polled on a short interval (~5s), pausable. A network/transport failure (no
response at all) is distinguished from a `503` DOWN and shown as "unreachable", so the
operator can tell "Artemis says it's down" apart from "I can't reach Artemis".

#### Scenario: Periodic refresh
- **WHEN** the Health view is open
- **THEN** it re-queries `/health` on an interval and updates without a manual reload

#### Scenario: Unreachable vs DOWN
- **WHEN** the request fails at the transport layer (connection refused/timeout)
- **THEN** the view shows an "unreachable" state distinct from a `503` DOWN response

### Requirement: Health drives the header indicator

The connection indicator in the app-shell header MUST reflect the latest health result
(live / down / unreachable / fixtures).

#### Scenario: Header stays in sync
- **WHEN** the health result changes
- **THEN** the header connection indicator updates to match

