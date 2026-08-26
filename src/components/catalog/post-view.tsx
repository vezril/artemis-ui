"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, FileQuestion } from "lucide-react";

import { ApiError } from "@/lib/api/types";
import { RATING_LABELS } from "@/lib/catalog/dsl";
import { formatDuration } from "@/lib/catalog/format";
import { usePost } from "@/lib/hooks/use-catalog";
import { MediaView } from "@/components/catalog/media-view";
import { PostActions } from "@/components/catalog/post-actions";
import { SimilarPosts } from "@/components/catalog/similar-posts";
import { AddToPool } from "@/components/pools/add-to-pool";
import { TagSidebar } from "@/components/catalog/tag-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The single-post read view: media (from the post's derivative refs, with a
 * placeholder fallback), a category-grouped tag sidebar, and metadata. A 404
 * renders a not-found state rather than crashing.
 */
export function PostView({ id }: { id: string }) {
  const { data: post, isLoading, isError, error } = usePost(id);

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center text-muted-foreground">
        {notFound ? (
          <>
            <FileQuestion className="size-8" />
            <p className="text-lg font-medium text-foreground">Post not found</p>
            <p className="text-sm">
              No post with id <code className="font-mono">{id}</code> — it may have been purged.
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="size-6 text-destructive" />
            <p>Couldn&apos;t load this post.</p>
            <p className="text-xs">{(error as Error)?.message}</p>
          </>
        )}
        <Link
          href="/search"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-3 py-4 sm:px-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-5 lg:w-64">
        <Link
          href="/search"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to search
        </Link>
        {isLoading || !post ? (
          <SidebarSkeleton />
        ) : (
          <>
            <PostActions post={post} />
            <AddToPool postId={post.id} />
            <TagSidebar post={post} />
            <PostMetadata post={post} />
            {/* Keyed by post id so the panel's "deferred" state resets on navigation — without
                this, one "Find similar" click would auto-fire the query on every post visited
                afterwards (the component re-renders in place, it doesn't remount). */}
            <SimilarPosts key={post.id} post={post} />
          </>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        {isLoading || !post ? (
          <Skeleton className="h-[70vh] w-full" />
        ) : (
          <MediaView post={post} />
        )}
      </div>
    </div>
  );
}

function PostMetadata({ post }: { post: import("@/lib/api/types").Post }) {
  const rows: [string, React.ReactNode][] = [
    ["Id", <span key="id" className="font-mono text-xs">{post.id}</span>],
    ["Status", post.status],
    ["Rating", post.rating ? (RATING_LABELS[post.rating] ?? post.rating) : "—"],
    ["Score", String(post.score)],
    ["Favorited", post.favorited ? "Yes" : "No"],
  ];
  if (post.width && post.height) rows.push(["Dimensions", `${post.width} × ${post.height}`]);
  if (post.duration != null) rows.push(["Duration", formatDuration(post.duration)]);
  if (post.filetype) rows.push(["Type", post.filetype]);
  if (post.parent) {
    rows.push([
      "Parent",
      <Link key="parent" href={`/posts/${post.parent}`} className="text-primary hover:underline">
        {post.parent}
      </Link>,
    ]);
  }
  if (post.source) {
    rows.push([
      "Source",
      <span key="source" className="truncate text-xs text-muted-foreground">
        {post.source}
      </span>,
    ]);
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Details</h2>
      <dl className="space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
