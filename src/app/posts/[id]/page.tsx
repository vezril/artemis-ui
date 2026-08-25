import type { Metadata } from "next";

import { PostView } from "@/components/catalog/post-view";

export const metadata: Metadata = { title: "Post" };

// Ids are opaque strings; Next 15 passes route params as a Promise.
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostView id={id} />;
}
