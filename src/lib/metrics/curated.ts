import type { ParsedMetrics } from "@/lib/api/types";

export type MetricUnit = "bytes" | "count" | "ratio" | "events" | "posts";

export interface CuratedSignal {
  /** Prometheus metric name to aggregate (summed across its label sets). */
  metric: string;
  title: string;
  group: string;
  unit: MetricUnit;
}

/**
 * The operator-facing signals, in display order and grouped. Chosen to answer "is it
 * up / is the ingest consume-loop draining", not to mirror every metric — the raw
 * view covers the rest. Names track Artemis's ACTUAL `/metrics` output, which uses the
 * Prometheus JVM client naming (jvm_*, process_*) plus its own `artemis_*` counters —
 * verified against the live service. A renamed/removed metric simply shows "no data".
 */
export const CURATED_SIGNALS: CuratedSignal[] = [
  { metric: "artemis_ready", title: "Ready", group: "Runtime", unit: "count" },
  {
    metric: "process_resident_memory_bytes",
    title: "Memory (RSS)",
    group: "Runtime",
    unit: "bytes",
  },
  { metric: "jvm_memory_bytes_used", title: "JVM memory used", group: "Runtime", unit: "bytes" },
  { metric: "jvm_threads_current", title: "Live threads", group: "Runtime", unit: "count" },
  { metric: "process_open_fds", title: "Open FDs", group: "Runtime", unit: "count" },
  {
    metric: "artemis_consume_messages_applied_total",
    title: "Msgs applied",
    group: "Consume loop",
    unit: "count",
  },
  {
    metric: "artemis_consume_polls_total",
    title: "Polls",
    group: "Consume loop",
    unit: "count",
  },
  {
    metric: "artemis_consume_poll_failures_total",
    title: "Poll failures",
    group: "Consume loop",
    unit: "count",
  },
];

/**
 * The headline number for a signal: the sum of finite values across every label set
 * of that metric name, or `null` when the metric is absent (→ "no data"). Non-finite
 * samples (`NaN`/`Inf`) are excluded from the sum but their presence still counts as
 * data.
 */
export function headlineValue(metrics: ParsedMetrics, metric: string): number | null {
  const matching = metrics.samples.filter((s) => s.name === metric);
  if (matching.length === 0) return null;
  return matching.reduce((sum, s) => (Number.isFinite(s.value) ? sum + s.value : sum), 0);
}

/** Format a headline value for its unit. */
export function formatValue(value: number, unit: MetricUnit): string {
  if (!Number.isFinite(value)) return String(value);
  switch (unit) {
    case "bytes":
      return formatBytes(value);
    case "ratio":
      return `${(value * 100).toFixed(1)}%`;
    default:
      return formatCount(value);
  }
}

function formatBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatCount(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
