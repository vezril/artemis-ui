"use client";

import * as React from "react";
import { Pause, Play, RefreshCw } from "lucide-react";

import { useMetrics } from "@/lib/hooks/use-metrics";
import { CURATED_SIGNALS } from "@/lib/metrics/curated";
import { getClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MetricCard } from "./metric-card";
import { RawMetrics } from "./raw-metrics";

/**
 * The metrics dashboard: curated signal cards grouped by area (each with a sparkline
 * over the polling window), plus a searchable raw view. Auto-refreshes ~10s; the
 * refresh can be paused.
 */
export function MetricsDashboard() {
  const [enabled, setEnabled] = React.useState(true);
  const { metrics, history, isLoading, isError, updatedAt, refetch } = useMetrics(enabled);
  const baseUrl = getClient().baseUrl;

  function toggle() {
    setEnabled((v) => {
      if (!v) refetch(); // resuming — refresh now instead of waiting a full interval
      return !v;
    });
  }

  const groups = React.useMemo(() => {
    const byGroup = new Map<string, typeof CURATED_SIGNALS>();
    for (const sig of CURATED_SIGNALS) {
      const list = byGroup.get(sig.group) ?? [];
      list.push(sig);
      byGroup.set(sig.group, list);
    }
    return [...byGroup.entries()];
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Metrics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {baseUrl ? (
              <>
                Parsed from <code className="text-foreground">{baseUrl}/metrics</code>
              </>
            ) : (
              <>Fixture metrics (no live Artemis configured)</>
            )}
            {updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggle}>
          {enabled ? <Pause className="size-4" /> : <Play className="size-4" />}
          {enabled ? "Pause" : "Resume"}
        </Button>
      </div>

      {isError ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <RefreshCw className="size-4" />
          Could not fetch /metrics. Check that Artemis is reachable.
        </div>
      ) : null}

      {isLoading && !metrics ? (
        <p className="text-muted-foreground">Loading metrics…</p>
      ) : (
        <div className="space-y-6">
          {groups.map(([group, signals]) => (
            <section key={group}>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {group}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {signals.map((sig) => (
                  <MetricCard
                    key={sig.metric}
                    signal={sig}
                    metrics={metrics}
                    history={history[sig.metric] ?? []}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <RawMetrics metrics={metrics} />
    </div>
  );
}
