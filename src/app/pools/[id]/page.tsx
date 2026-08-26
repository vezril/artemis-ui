import type { Metadata } from "next";

import { PoolView } from "@/components/pools/pool-view";

export const metadata: Metadata = { title: "Pool" };

// Ids are opaque strings; Next 15 passes route params as a Promise.
export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PoolView id={id} />;
}
