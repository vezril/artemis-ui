# Deploying Artemis UI

Artemis UI is a Next.js console packaged as a small standalone image
(`calvinference/artemisui`, published by `.github/workflows/release.yml` on a
`vX.Y.Z` tag) and deployed to the homelab k3s cluster by **Codex** via Flux.

## Architecture: same-origin BFF proxy

The browser only ever talks to this app's own origin. The client is built with
`NEXT_PUBLIC_ARTEMIS_BASE_URL=/api/artemis` (a **relative** base baked at image
build time — see `Dockerfile`), so every API/media call goes to
`/api/artemis/*`. The catch-all route handler at
`src/app/api/artemis/[...path]/route.ts` forwards those **server-side** to
`ARTEMIS_UPSTREAM` (default `http://artemis.artemis.svc.cluster.local:8080`),
streaming responses verbatim (JSON, Prometheus text, and ranged binary media).

Consequences:
- **No CORS** requirement on Artemis, and no need to expose the catalog API to
  the network — only this UI is exposed.
- **Env-agnostic image**: the baked base is relative, so the same image works via
  port-forward, tailnet, or ingress with no rebuild. Only `ARTEMIS_UPSTREAM`
  (a plain server-side env in the chart) changes per environment.
- Artemis's request-tracing trust model is preserved: its HTTP edge mints and
  ignores correlation ids as untrusted ingress.

## Chart

`deploy/charts/artemis-ui` — a Deployment (2 replicas, unprivileged, readiness
/liveness on `GET /`), a ClusterIP Service (80→3000), and an optional Ingress
(off by default). `deploy/flux/artemis-ui-helmrelease.yaml` is a reference
GitRepository + HelmRelease (Codex keeps the canonical copies under
`apps/artemis-ui`). The repo is public, so no git-auth secretRef is required.

### Key values

| value | default | notes |
|---|---|---|
| `image.repository` / `image.tag` | `calvinference/artemisui` / `latest` | pin to a released semver tag in prod |
| `artemisUpstream` | `http://artemis.artemis.svc.cluster.local:8080` | **server-side** BFF target (not `NEXT_PUBLIC`) |
| `replicaCount` | `1` | single-node cluster |
| `ingress.enabled` | `false` | reach via port-forward; enable for tailnet (`className: ""`, `host: artemis.tailscale`, no TLS) or Traefik+cert-manager (set `clusterIssuer`) |

### Local

```
kubectl -n artemis-ui port-forward svc/artemis-ui 8080:80
```

then open http://localhost:8080. Requires egress to ns `artemis` :8080 (cluster
is default-allow; no NetworkPolicies).
