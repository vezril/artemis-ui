"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import type { OrderKey, PostSummary } from "@/lib/api/types";
import { useInfinitePosts } from "@/lib/hooks/use-catalog";
import { PostTile } from "@/components/catalog/post-tile";
import { GallerySkeleton } from "@/components/catalog/gallery-skeleton";

/**
 * The results gallery: a masonry grid of the search results with keyset infinite
 * scroll. As the sentinel nears the viewport the next cursor page loads; a null
 * `nextCursor` ends the list with an end-of-results marker.
 */
export function Gallery({
  tags,
  order,
  emptyMessage = "No posts match this search.",
}: {
  tags: string;
  order: OrderKey;
  emptyMessage?: string;
}) {
  const { data, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfinitePosts(tags, order);

  const posts: PostSummary[] = React.useMemo(
    () => data?.pages.flatMap((p) => p.posts) ?? [],
    [data],
  );

  // Sentinel-driven fetch: load the next cursor page as it nears the viewport.
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <GallerySkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center text-muted-foreground">
        <AlertCircle className="size-6 text-destructive" />
        <p>Couldn&apos;t load results.</p>
        <p className="text-xs">{(error as Error)?.message}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return <div className="py-24 text-center text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5 [&>*]:mb-3">
        {posts.map((post) => (
          <div key={post.id} className="break-inside-avoid">
            <PostTile post={post} />
          </div>
        ))}
      </div>

      <div ref={sentinelRef} />
      <div className="flex justify-center py-8 text-sm text-muted-foreground">
        {isFetchingNextPage ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading more…
          </span>
        ) : !hasNextPage ? (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4" /> End of results
          </span>
        ) : null}
      </div>
    </>
  );
}
