import type { Metadata } from "next";

import { HealthView } from "@/components/health/health-view";

export const metadata: Metadata = { title: "Health" };

export default function HealthPage() {
  return <HealthView />;
}
