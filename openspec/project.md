# Project context — Artemis UI

The per-service management console for **Artemis** (the constellation's catalog + tags +
search API). One Next.js app that both operates the service and curates its catalog.

## Tech stack

- Next.js 15 (App Router, React Server Components) + React 19, TypeScript (strict).
- Tailwind CSS v4 (`@tailwindcss/postcss`) + shadcn/ui primitives (Radix) in `src/components/ui`.
- TanStack Query for the client cache, keyset infinite scroll, and optimistic mutations.
- `@/*` path alias → `src/*`. `cn()` (clsx + tailwind-merge) in `src/lib/utils.ts`.
- Dark by default; tag-category color palette in `globals.css` (always paired with a text
  label, never color-only).

## Conventions

- REST/JSON to Artemis only — never gRPC. Media is fetched as HTTP URLs from the Artemis
  media gateway (`GET /media/{md5}/{variant}`), which streams Apollo derivatives.
- A typed `ArtemisClient` interface with two implementations: a `fixtureClient` (default,
  for dev/build before a live Artemis) and an `httpClient(baseUrl)` selected by
  `NEXT_PUBLIC_ARTEMIS_BASE_URL`. Mirror muses-ui's `src/lib/api` seam.
- Conventional commits; PRs target `development`, releases promote `development → main` and
  tag `vX.Y.Z` on `main` (CI: lint + typecheck + build; release: Docker image to Docker Hub
  as `artemisui`, main-ancestry + semver-immutability gates).
- Spec-driven (OpenSpec) workflow: capture a design change, then implement its tasks;
  archive on completion, promoting living specs.

## Artemis REST API (the contract this UI consumes)

Base path: none (routes at root). **No auth** anywhere. Every response carries a
server-**minted** `X-Correlation-Id` (client-supplied values are ignored — anti-injection).
Shared error body: `{"error": "<message>"}`.

Operations:
- `GET /health` → `{status:"UP"|"DOWN", service, version}` (503 when DOWN).
- `GET /metrics` → Prometheus text exposition (`text/plain`).
- `POST /reprocess` `{select, kind}` → `{enqueued:int}`. `select` = `stale` | `id:<x>` |
  a search-DSL query; `kind` ∈ `derivatives|metadata|tags`.

Catalog (read/write; entity reads are read-your-writes, search reads the projection):
- `GET /posts?tags=<DSL>&order=&cursor=&limit=` → `{posts: PostSummary[], nextCursor?}`
  (keyset pagination; `cursor` is opaque; `order` must stay stable across a paged sequence).
- `GET /posts/facets?tags=<DSL>` → `{facets:[{category, tags:[{name, count}]}]}`.
- `GET /tags/autocomplete?q=&context=tag|metatag` → tag rows (snake_case:
  `{name, category, post_count, alias_of?}`) or a bare string array for metatags.
- `GET /posts/{id}` → `PostResponse`; `POST /posts` `{id, md5, filetype}` → 201.
- `PATCH /posts/{id}/tags` `{tags:[]}`; `PATCH /posts/{id}/rating` `{rating}`;
  `POST /posts/{id}/score` `{delta}`; `POST|DELETE /posts/{id}/favorite`;
  `GET /posts/{id}/status`.
- `POST /uploads?mediaType=` — **raw request body**, `Content-Type` sets MIME →
  `201 {postId, status:"pending"}`; empty → 400; downstream failure → 502.
- Pools: `GET|POST /pools`, `GET|PATCH|DELETE /pools/{id}`, `POST /pools/{id}/posts`,
  `DELETE /pools/{id}/posts/{postId}`, `PUT /pools/{id}/order`.
- Saved searches: `GET|POST /saved-searches`, `PATCH|DELETE /saved-searches/{name}`,
  `GET /saved-searches/{name}/results`.
- Related tags: `GET /tags/{name}/related?limit=` → cosine-ranked co-occurring tags.
- Similarity: `GET /posts/{id}/similar?threshold=&limit=`, `GET /similar?phash=&...`.
- Review queue: `GET /review?limit=` → `{posts:[{postId, suggestions:[{tag, confidence,
  source}]}]}`; `POST /posts/{id}/review` `{accept:[]?}` (absent/empty ⇒ reject-all).

Search DSL: space-separated terms; `-tag` exclude, `~tag` OR-group, `*` wildcard,
`name:value` metatags (scalar / `>` `>=` `<` `<=` / `lo..hi` range). Orders: `id`, `score`,
`favcount`, `duration`, `mpixels`, `date` (default), `random` (seeded, stable across pages).
A search failure is always `400`, never `500`.
