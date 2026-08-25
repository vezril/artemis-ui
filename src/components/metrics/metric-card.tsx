"use client";

import type { ParsedMetrics } from "@/lib/api/types";
import { formatValue, headlineValue, type CuratedSignal } from "@/lib/metrics/curated";
import { Sparkline } from "./sparkline";

/**
 * One curated-signal card: title, current headline value (formatted for its unit),
 * and a sparkline over the polling window. An absent metric degrades to "no data"
 * rather than disappearing.
 */
export function MetricCard({
  signal,
  metrics,
  history,
}: {
  signal: CuratedSignal;
  metrics: ParsedMetrics | undefined;
  history: number[];
}) {
  const value = metrics ? headlineValue(metrics, signal.metric) : null;
  const hasData = value !== null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{signal.title}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {hasData ? formatValue(value, signal.unit) : <span className="text-muted-foreground/60">no data</span>}
          </p>
        </div>
        <div className="text-primary/80">
          <Sparkline data={history} />
        </div>
      </div>
      <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground/70" title={signal.metric}>
        {signal.metric}
      </p>
    </div>
  );
}
