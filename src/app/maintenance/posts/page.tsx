import type { Metadata } from "next";

import { PostAdminView } from "@/components/maintenance/post-admin-view";

export const metadata: Metadata = { title: "Posts" };

export default function PostsMaintenancePage() {
  return <PostAdminView />;
}
