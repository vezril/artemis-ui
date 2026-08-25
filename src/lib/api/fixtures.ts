import type { ArtemisClient } from "./client";
import { ApiError, type Health, type ReprocessRequest, type ReprocessResult } from "./types";

/**
 * A representative Prometheus exposition, shaped like Artemis's `/metrics`, so the
 * dashboard renders and the parser is exercised without a live service. Values drift
 * a little per call so sparklines animate in fixture mode.
 */
function metricsSample(tick: number): string {
  const jitter = (base: number, amp: number) =>
    (base + amp * Math.sin(tick / 3) + amp * 0.3 * ((tick % 5) - 2)).toFixed(3);
  return `# HELP jvm_memory_used_bytes The amount of used memory.
# TYPE jvm_memory_used_bytes gauge
jvm_memory_used_bytes{area="heap"} ${jitter(4.2e8, 3e7)}
jvm_memory_used_bytes{area="nonheap"} ${jitter(1.1e8, 5e6)}
# HELP jvm_threads_live_threads The current number of live threads.
# TYPE jvm_threads_live_threads gauge
jvm_threads_live_threads ${jitter(48, 4)}
# HELP process_cpu_usage The "recent cpu usage" of the JVM process.
# TYPE process_cpu_usage gauge
process_cpu_usage ${jitter(0.18, 0.08)}
# HELP http_server_requests_seconds Duration of HTTP server request handling.
# TYPE http_server_requests_seconds summary
http_server_requests_seconds_count{method="GET",status="200",uri="/posts"} ${Math.floor(
    12000 + tick * 7,
  )}
http_server_requests_seconds_sum{method="GET",status="200",uri="/posts"} ${jitter(940, 20)}
http_server_requests_seconds_count{method="POST",status="201",uri="/uploads"} ${Math.floor(
    320 + tick,
  )}
# HELP artemis_projection_lag_events The read-model projection lag in events.
# TYPE artemis_projection_lag_events gauge
artemis_projection_lag_events{projection="posts"} ${Math.max(0, Math.round(+jitter(6, 6)))}
artemis_projection_lag_events{projection="pools"} ${Math.max(0, Math.round(+jitter(2, 3)))}
# HELP artemis_hermes_consumed_total Messages consumed from Hermes.
# TYPE artemis_hermes_consumed_total counter
artemis_hermes_consumed_total{subscription="media.processed"} ${Math.floor(8800 + tick * 3)}
artemis_hermes_consumed_total{subscription="media.tags.suggested"} ${Math.floor(4100 + tick * 2)}
# HELP artemis_hermes_published_total Messages published to Hermes.
# TYPE artemis_hermes_published_total counter
artemis_hermes_published_total{topic="media.process"} ${Math.floor(5200 + tick)}
# HELP artemis_posts_active Number of active posts (from the projection).
# TYPE artemis_posts_active gauge
artemis_posts_active ${Math.floor(15230 + tick)}
# HELP artemis_review_queue_depth Posts awaiting auto-tag review.
# TYPE artemis_review_queue_depth gauge
artemis_review_queue_depth ${Math.max(0, Math.round(+jitter(37, 20)))}
`;
}

export function fixtureClient(): ArtemisClient {
  let tick = 0;
  return {
    live: false,
    baseUrl: null,

    async getHealth(): Promise<Health> {
      return { status: "UP", service: "artemis", version: "1.1.1" };
    },

    async getMetricsText(): Promise<string> {
      return metricsSample(tick++);
    },

    async reprocess(req: ReprocessRequest): Promise<ReprocessResult> {
      if (!req.select.trim()) throw new ApiError("empty selection", 400);
      // Pretend a plausible enqueue count keyed off the selection shape.
      const enqueued = req.select === "stale" ? 128 : req.select.startsWith("id:") ? 1 : 42;
      return { enqueued };
    },

    async previewSelectionCount(): Promise<number | null> {
      // Fixtures have no catalog to count against.
      return null;
    },
  };
}
