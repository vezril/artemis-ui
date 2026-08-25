import { describe, expect, it } from "vitest";

import { parsePrometheus } from "./prom-parse";

describe("parsePrometheus", () => {
  it("parses HELP/TYPE metadata and a bare sample", () => {
    const { samples, meta } = parsePrometheus(
      `# HELP jvm_threads_live_threads The current number of live threads.
# TYPE jvm_threads_live_threads gauge
jvm_threads_live_threads 48`,
    );
    expect(meta.jvm_threads_live_threads).toEqual({
      help: "The current number of live threads.",
      type: "gauge",
    });
    expect(samples).toEqual([{ name: "jvm_threads_live_threads", labels: {}, value: 48 }]);
  });

  it("parses labels, including multiple label sets for one metric", () => {
    const { samples } = parsePrometheus(
      `artemis_projection_lag_events{projection="posts"} 6
artemis_projection_lag_events{projection="pools"} 2`,
    );
    expect(samples).toEqual([
      { name: "artemis_projection_lag_events", labels: { projection: "posts" }, value: 6 },
      { name: "artemis_projection_lag_events", labels: { projection: "pools" }, value: 2 },
    ]);
  });

  it("handles a label value containing an escaped quote and a comma", () => {
    const { samples } = parsePrometheus(`http_requests{uri="/a,b",note="he said \\"hi\\""} 3`);
    expect(samples[0].labels).toEqual({ uri: "/a,b", note: 'he said "hi"' });
    expect(samples[0].value).toBe(3);
  });

  it("represents NaN and ±Inf without throwing", () => {
    const { samples } = parsePrometheus(
      `a_nan NaN
a_pos +Inf
a_inf Inf
a_neg -Inf`,
    );
    expect(Number.isNaN(samples[0].value)).toBe(true);
    expect(samples[1].value).toBe(Infinity);
    expect(samples[2].value).toBe(Infinity);
    expect(samples[3].value).toBe(-Infinity);
  });

  it("ignores an optional trailing timestamp", () => {
    const { samples } = parsePrometheus(`process_cpu_usage 0.18 1699999999000`);
    expect(samples).toEqual([{ name: "process_cpu_usage", labels: {}, value: 0.18 }]);
  });

  it("skips an unparseable line but keeps the rest (never throws)", () => {
    const { samples, skipped } = parsePrometheus(
      `good_metric 1
this is not a metric line
also_good{k="v"} 2`,
    );
    expect(samples.map((s) => s.name)).toEqual(["good_metric", "also_good"]);
    expect(skipped).toBe(1);
  });

  it("treats a malformed label block as a skipped line, not a crash", () => {
    const { samples, skipped } = parsePrometheus(`broken{unterminated= 5
ok 7`);
    expect(samples.map((s) => s.name)).toEqual(["ok"]);
    expect(skipped).toBe(1);
  });

  it("rejects a label set with a missing comma rather than silently dropping a label", () => {
    const { samples, skipped } = parsePrometheus(`bad{a="1" b="2"} 5
ok 7`);
    expect(samples.map((s) => s.name)).toEqual(["ok"]);
    expect(skipped).toBe(1);
  });

  it("ignores blank lines and plain comments", () => {
    const { samples, skipped } = parsePrometheus(`
# just a comment

metric_a 1
`);
    expect(samples).toEqual([{ name: "metric_a", labels: {}, value: 1 }]);
    expect(skipped).toBe(0);
  });

  it("parses scientific notation and negative values", () => {
    const { samples } = parsePrometheus(`jvm_memory_used_bytes{area="heap"} 4.2e8`);
    expect(samples[0].value).toBe(4.2e8);
  });
});
