import type { Metadata } from "next";

import { ReprocessForm } from "@/components/reprocess/reprocess-form";

export const metadata: Metadata = { title: "Reprocess" };

export default function ReprocessPage() {
  return <ReprocessForm />;
}
