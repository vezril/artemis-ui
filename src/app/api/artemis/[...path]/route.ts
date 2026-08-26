/**
 * BFF proxy: same-origin `/api/artemis/*` → the in-cluster Artemis API. The browser only ever
 * talks to this app's own origin, so there is no CORS requirement on Artemis and no need to expose
 * the catalog API to the network. The client is built with `NEXT_PUBLIC_ARTEMIS_BASE_URL=/api/artemis`
 * (a relative base — env-agnostic image), and this handler forwards each request server-side to
 * `ARTEMIS_UPSTREAM` (e.g. `http://artemis.artemis.svc.cluster.local:8080`).
 *
 * It forwards method, query string, headers (notably `Range`, for media seeking), and the request
 * body (buffered, with a known content-length — see the note at the fetch), and streams the
 * response back verbatim (status, headers, and the raw byte stream) — so JSON, Prometheus text,
 * and ranged binary media all pass through unchanged. Artemis's request-tracing
 * trust model is preserved: the HTTP edge still mints-and-ignores correlation ids as untrusted
 * ingress (the browser can't set one that survives).
 */
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPSTREAM = (process.env.ARTEMIS_UPSTREAM ?? "http://localhost:8080").replace(/\/$/, "");

// Hop-by-hop / connection-management headers must not be forwarded verbatim.
// `expect` is the load-bearing one: clients (curl among them) send
// `Expect: 100-continue` for bodies over ~1MB, and undici's fetch REFUSES the
// header outright (UND_ERR_NOT_SUPPORTED) — forwarding it made every >1MB
// upload fail as a bogus 502 while small uploads sailed through.
const STRIP_REQUEST_HEADERS = [
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "expect",
];
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

  // BUFFER request bodies rather than re-streaming them. Streaming (`req.body` +
  // `duplex: "half"`) forwards uploads as chunked transfer-encoding with no
  // content-length, which empirically failed for bodies over ~1MB (the upstream
  // fetch rejected and every >1MB upload surfaced as a bogus "unreachable" 502,
  // while small uploads passed). Buffering gives undici a known length, which
  // real photos (3–10MB) handle fine and is a non-issue at this deployment's
  // single-user scale. Response bodies still stream through untouched.
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      body = await req.arrayBuffer();
    } catch {
      return new Response(JSON.stringify({ error: "could not read the request body" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (err) {
    // Honest wording: the proxy's REQUEST failed — which includes but is not limited
    // to Artemis being down. The cause is logged server-side for diagnosis.
    console.error(`[bff] proxy request to ${target} failed:`, err);
    return new Response(
      JSON.stringify({ error: "proxy request to artemis failed — is Artemis reachable?" }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
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
