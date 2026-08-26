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

  const stamp = query.dataUpdatedAt;

  // Accumulate history with the documented "storing information from previous
  // renders" pattern (state adjusted DURING render behind a change guard) —
  // pure under Strict Mode's double-invoke (the second pass sees the applied
  // stamp and no-ops) and free of ref-reads-in-render / setState-in-effect.
  const [applied, setApplied] = React.useState<{
    stamp: number;
    history: Record<string, number[]>;
  }>({ stamp: 0, history: {} });
  let history = applied.history;
  if (query.data && applied.stamp !== stamp) {
    const next: Record<string, number[]> = { ...applied.history };
    for (const sig of CURATED_SIGNALS) {
      const v = headlineValue(query.data, sig.metric);
      if (v === null || !Number.isFinite(v)) continue;
      const series = [...(next[sig.metric] ?? []), v];
      next[sig.metric] = series.slice(-HISTORY);
    }
    history = next;
    setApplied({ stamp, history: next });
  }

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
