/**
 * BFF proxy: same-origin `/api/artemis/*` → the in-cluster Artemis API. The browser only ever
 * talks to this app's own origin, so there is no CORS requirement on Artemis and no need to expose
 * the catalog API to the network. The client is built with `NEXT_PUBLIC_ARTEMIS_BASE_URL=/api/artemis`
 * (a relative base — env-agnostic image), and this handler forwards each request server-side to
 * `ARTEMIS_UPSTREAM` (e.g. `http://artemis.artemis.svc.cluster.local:8080`).
 *
 * It forwards method, query string, headers (notably `Range`, for media seeking), and the request
 * body, and streams the response back verbatim (status, headers, and the raw byte stream) — so JSON,
 * Prometheus text, and ranged binary media all pass through unchanged. Artemis's request-tracing
 * trust model is preserved: the HTTP edge still mints-and-ignores correlation ids as untrusted
 * ingress (the browser can't set one that survives).
 */
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPSTREAM = (process.env.ARTEMIS_UPSTREAM ?? "http://localhost:8080").replace(/\/$/, "");

// Hop-by-hop / connection-management headers must not be forwarded verbatim.
const STRIP_REQUEST_HEADERS = ["host", "connection", "content-length", "transfer-encoding"];
const STRIP_RESPONSE_HEADERS = ["connection", "transfer-encoding", "content-encoding"];

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const search = req.nextUrl.search;
  const target = `${UPSTREAM}/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers = new Headers(req.headers);
  for (const h of STRIP_REQUEST_HEADERS) headers.delete(h);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // Required by Node/undici to stream a request body.
      ...(hasBody ? { duplex: "half" } : {}),
      redirect: "manual",
      cache: "no-store",
    } as RequestInit);
  } catch {
    return new Response(JSON.stringify({ error: "artemis upstream unreachable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const respHeaders = new Headers(upstream.headers);
  for (const h of STRIP_RESPONSE_HEADERS) respHeaders.delete(h);
  // Stream the raw body through unchanged (ranged media, JSON, metrics text all pass verbatim).
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export {
  proxy as GET,
  proxy as HEAD,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};
