import type { Metadata } from "next";

import { GcView } from "@/components/maintenance/gc-view";

export const metadata: Metadata = { title: "Garbage collection" };

export default function GcMaintenancePage() {
  return <GcView />;
}
