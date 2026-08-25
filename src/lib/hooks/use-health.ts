"use client";

import { useQuery } from "@tanstack/react-query";

import { getClient } from "@/lib/api";
import type { ConnectionState, Health } from "@/lib/api/types";

export interface HealthState {
  health: Health | undefined;
  connection: ConnectionState;
  isLoading: boolean;
  /** Set when the transport failed (couldn't reach Artemis at all). */
  unreachable: boolean;
}

/**
 * Poll `GET /health` (~5s) and derive the connection state the header shows.
 * Distinguishes a `503` DOWN body (Artemis says down) from a transport failure
 * (unreachable), and reports "fixtures" when no live target is configured.
 */
export function useHealth(pollMs = 5000): HealthState {
  const client = getClient();
  const query = useQuery({
    queryKey: ["health", client.baseUrl],
    queryFn: () => client.getHealth(),
    refetchInterval: pollMs,
    retry: false,
  });

  let connection: ConnectionState;
  if (!client.live) connection = "fixtures";
  else if (query.isError) connection = "unreachable";
  else if (query.data?.status === "DOWN") connection = "down";
  else if (query.data?.status === "UP") connection = "up";
  else connection = "unreachable";

  return {
    health: query.data,
    connection,
    isLoading: query.isLoading,
    unreachable: client.live && query.isError,
  };
}
