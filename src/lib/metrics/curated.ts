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
 * The operator-facing signals, in display order and grouped. Chosen to answer "is
 * it healthy / is the projection lagging / is the ingest draining", not to mirror
 * every metric — the raw view covers the rest. Names track Artemis's Micrometer
 * output; a renamed/removed metric simply shows "no data" on its card.
 */
export const CURATED_SIGNALS: CuratedSignal[] = [
  { metric: "process_cpu_usage", title: "Process CPU", group: "Runtime", unit: "ratio" },
  { metric: "jvm_memory_used_bytes", title: "Memory used", group: "Runtime", unit: "bytes" },
  { metric: "jvm_threads_live_threads", title: "Live threads", group: "Runtime", unit: "count" },
  {
    metric: "http_server_requests_seconds_count",
    title: "HTTP requests",
    group: "HTTP",
    unit: "count",
  },
  {
    metric: "artemis_projection_lag_events",
    title: "Projection lag",
    group: "Projection",
    unit: "events",
  },
  {
    metric: "artemis_hermes_consumed_total",
    title: "Hermes consumed",
    group: "Messaging",
    unit: "count",
  },
  {
    metric: "artemis_hermes_published_total",
    title: "Hermes published",
    group: "Messaging",
    unit: "count",
  },
  { metric: "artemis_posts_active", title: "Active posts", group: "Catalog", unit: "count" },
  { metric: "artemis_review_queue_depth", title: "Review queue", group: "Catalog", unit: "posts" },
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
