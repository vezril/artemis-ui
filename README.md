# Artemis UI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Artemis UI** is the dedicated management console for the **Artemis** service — the
catalog + tags + search API of the constellation. It is a per-service UI: one console that
both **operates** the service (health, metrics, reprocessing, garbage collection) and
**curates** its catalog (grammar-aware search, post view, uploads, tag editing, pools,
saved searches, and the auto-tag review queue).

It is a Next.js client over the Artemis REST API. It renders the operational state of the
service and the catalog it holds, and drives the asynchronous ingest/reprocess pipelines
from a single place.

## Scope

- **Operations** — liveness/readiness, a metrics dashboard (parsed from Artemis's
  Prometheus exposition), reprocessing (trigger a selection + kind, report what enqueued),
  and deletion/GC + near-duplicate tools.
- **Catalog** — DSL search with category-colored autocomplete, post detail, raw-body
  uploads with live `pending → active` status, optimistic tag edits, rating/score/favorite,
  ordered pools, saved searches, and the auto-tag **review queue**.

## Stack

```
   Next.js (App Router, RSC) · TypeScript · Tailwind · shadcn/ui (Radix)
   TanStack Query · keyset infinite scroll · REST/JSON to Artemis
```

Media (thumbnails, samples, transcodes) is served as HTTP URLs derived from the Apollo
object store via the Artemis media gateway — the UI never speaks gRPC. Artemis exposes no
auth today (single-user homelab), so the console sends no credentials.

## The constellation

Artemis UI is one service in a homelab media platform deployed by **Codex**: alongside
**Artemis** (catalog + tags + search API), **Hephaestus** (media workers), **Apollo**
(object storage), **HermesMQ** (pub/sub), and **Argus** (auto-tagging). It supersedes the
unified UI approach in favour of one console per service.

## Status

**Scaffold.** The UX is being captured as an OpenSpec design and built capability by
capability (see `openspec/`), following the same spec-driven, CI-gated workflow as the
sibling repos.

## AI Usage Disclaimer

Developed with a **Claude Code** AI-assisted SDLC team under human direction, following a
spec-driven (OpenSpec) workflow. All decisions and merges are reviewed by a human.

## License

Released under the [MIT License](LICENSE) — © 2026 Calvin Ference.
