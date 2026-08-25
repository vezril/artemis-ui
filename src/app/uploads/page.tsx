import type { Metadata } from "next";

import { UploadsView } from "@/components/upload/uploads-view";

export const metadata: Metadata = { title: "Uploads" };

export default function UploadsPage() {
  return <UploadsView />;
}
