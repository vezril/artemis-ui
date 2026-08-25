"use client";

import * as React from "react";

import type { ParsedMetrics } from "@/lib/api/types";
import { Input } from "@/components/ui/input";

/** Searchable table of every parsed sample — the escape hatch beyond curated cards. */
export function RawMetrics({ metrics }: { metrics: ParsedMetrics | undefined }) {
  const [filter, setFilter] = React.useState("");

  const rows = React.useMemo(() => {
    if (!metrics) return [];
    const q = filter.trim().toLowerCase();
    const withLabels = metrics.samples.map((s) => ({
      ...s,
      labelStr: Object.entries(s.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(", "),
    }));
    if (!q) return withLabels;
    return withLabels.filter(
      (s) => s.name.toLowerCase().includes(q) || s.labelStr.toLowerCase().includes(q),
    );
  }, [metrics, filter]);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Raw metrics</h2>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or label…"
          className="max-w-xs"
        />
      </div>
      {metrics && metrics.skipped > 0 ? (
        <p className="mb-2 text-xs text-amber-400">
          {metrics.skipped} line{metrics.skipped === 1 ? "" : "s"} could not be parsed and were
          skipped.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 font-medium">Labels</th>
              <th className="px-3 py-2 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  {metrics ? "No matching samples." : "Loading…"}
                </td>
              </tr>
            ) : (
              rows.map((s, i) => (
                <tr key={`${s.name}-${i}`} className="border-t border-border/60">
                  <td className="px-3 py-1.5 font-mono">{s.name}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{s.labelStr}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{String(s.value)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
