"use client";

import Link from "next/link";
import { AlertCircle, Layers } from "lucide-react";

import { getClient } from "@/lib/api";
import type { PoolSummary } from "@/lib/api/types";
import { mediaUrl, thumbnailVariant } from "@/lib/api/media";
import { usePools } from "@/lib/hooks/use-pools";
import { MediaPlaceholder } from "@/components/catalog/media-placeholder";
import { NewPoolDialog } from "@/components/pools/new-pool-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Pools index: keyset-paged grid of pool cards — cover thumbnail (or a
 * placeholder for an empty pool), name, member count — plus the New pool dialog.
 */
export function PoolsView() {
  const query = usePools();
  const pools = query.data?.pages.flatMap((p) => p.pools) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pools</h1>
        <NewPoolDialog />
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4" aria-hidden />
          Could not load pools. {query.error?.message}
        </p>
      ) : pools.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center text-muted-foreground">
          <Layers className="size-8" aria-hidden />
          <p className="font-medium text-foreground">No pools yet</p>
          <p className="text-sm">Create one to keep a series of posts in reading order.</p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {pools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </ul>
          {query.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** One pool card: cover (or placeholder), name, member count. Links to the detail. */
function PoolCard({ pool }: { pool: PoolSummary }) {
  const baseUrl = getClient().baseUrl;
  const variant = pool.cover ? thumbnailVariant(pool.cover.derivatives) : null;
  const thumb = variant ? mediaUrl(baseUrl, pool.cover?.md5, variant.variant) : null;

  return (
    <li>
      <Link
        href={`/pools/${pool.id}`}
        className="group block overflow-hidden rounded-lg border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-square overflow-hidden">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote media-gateway URLs
            <img
              src={thumb}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <MediaPlaceholder label={pool.name} />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-2.5 py-2">
          <span className="truncate text-sm font-medium">{pool.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {pool.postCount} {pool.postCount === 1 ? "post" : "posts"}
          </span>
        </div>
      </Link>
    </li>
  );
}
