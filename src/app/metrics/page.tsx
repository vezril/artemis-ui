import type { Metadata } from "next";

import { MetricsDashboard } from "@/components/metrics/metrics-dashboard";

export const metadata: Metadata = { title: "Metrics" };

export default function MetricsPage() {
  return <MetricsDashboard />;
}
