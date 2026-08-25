"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { getClient } from "@/lib/api";
import type { ParsedMetrics } from "@/lib/api/types";
import { CURATED_SIGNALS, headlineValue } from "@/lib/metrics/curated";
import { parsePrometheus } from "@/lib/metrics/prom-parse";

const HISTORY = 30; // sparkline points retained per signal

export interface MetricsState {
  metrics: ParsedMetrics | undefined;
  /** Per-signal history of headline values, oldest→newest, for sparklines. */
  history: Record<string, number[]>;
  isLoading: boolean;
  isError: boolean;
  /** Timestamp label of the latest successful poll (client clock). */
  updatedAt: number | undefined;
  /** Force an immediate refetch (e.g. on resume, so the view isn't stale for pollMs). */
  refetch: () => void;
}

/**
 * Poll `GET /metrics` (~10s when enabled), parse it client-side, and accumulate a
 * short per-signal history so cards can draw sparklines across polls.
 */
export function useMetrics(enabled: boolean, pollMs = 10000): MetricsState {
  const client = getClient();
  const query = useQuery({
    queryKey: ["metrics", client.baseUrl],
    queryFn: async () => parsePrometheus(await client.getMetricsText()),
    refetchInterval: enabled ? pollMs : false,
    enabled,
    retry: false,
  });

  const historyRef = React.useRef<Record<string, number[]>>({});
  const appliedStamp = React.useRef<number>(0);
  const stamp = query.dataUpdatedAt;

  const history = React.useMemo(() => {
    // The memo factory must be pure — React may run it more than once per commit
    // (Strict Mode does, and `reactStrictMode` is on). Guarding on the poll's stamp
    // makes a duplicate invocation a no-op, so each poll is appended exactly once.
    if (!query.data || appliedStamp.current === stamp) return historyRef.current;
    appliedStamp.current = stamp;
    const next: Record<string, number[]> = { ...historyRef.current };
    for (const sig of CURATED_SIGNALS) {
      const v = headlineValue(query.data, sig.metric);
      if (v === null || !Number.isFinite(v)) continue;
      const series = [...(next[sig.metric] ?? []), v];
      next[sig.metric] = series.slice(-HISTORY);
    }
    historyRef.current = next;
    return next;
    // Recompute only when a new poll lands (dataUpdatedAt changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  return {
    metrics: query.data,
    history,
    isLoading: query.isLoading,
    isError: query.isError,
    updatedAt: query.data ? query.dataUpdatedAt : undefined,
    refetch: () => {
      void query.refetch();
    },
  };
}
