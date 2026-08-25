import type { ArtemisClient } from "./client";
import { fixtureClient } from "./fixtures";
import { httpClient } from "./http";

/**
 * Client selector. Uses the live HTTP client when `NEXT_PUBLIC_ARTEMIS_BASE_URL`
 * is set (inlined at build time, safe on the client), otherwise the fixtures client
 * — so the console builds and runs before a live Artemis is reachable.
 *
 * On the client it is memoized so every caller shares one instance (one browser).
 * On the server (SSR of a client component) it deliberately builds a THROWAWAY per
 * call: a module-level singleton on the server is shared across all concurrent
 * requests in the Node process, and the fixture client carries mutable state — so we
 * never share one there. All data-fetching runs from client hooks regardless.
 */
let browserClient: ArtemisClient | undefined;

function build(): ArtemisClient {
  const baseUrl = process.env.NEXT_PUBLIC_ARTEMIS_BASE_URL;
  return baseUrl ? httpClient(baseUrl) : fixtureClient();
}

export function getClient(): ArtemisClient {
  if (typeof window === "undefined") return build();
  if (!browserClient) browserClient = build();
  return browserClient;
}

export type { ArtemisClient } from "./client";
