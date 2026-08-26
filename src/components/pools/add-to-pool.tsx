"use client";

import * as React from "react";
import { Check, Layers } from "lucide-react";

import { useAddToPool, usePools } from "@/lib/hooks/use-pools";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The post view's "Add to pool" action: a menu of existing pools; choosing one
 * appends this post (idempotent server-side, so re-adding is a calm success).
 * There is no reverse-lookup endpoint yet, so current membership isn't shown —
 * the confirmation is per-action ("Added"), not per-pool state.
 */
export function AddToPool({ postId }: { postId: string }) {
  const pools = usePools();
  const add = useAddToPool();
  const [added, setAdded] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // KNOWN LIMITATION: only the fetched pages appear (first page unless the index
  // view already paged further) — fine at realistic pool counts; a searchable
  // picker is the fix if a catalog ever exceeds one page of pools.
  const options = pools.data?.pages.flatMap((p) => p.pools) ?? [];

  return (
    <div className="space-y-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Layers className="size-4" aria-hidden />
            Add to pool
            {added && (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="size-3.5" aria-hidden /> Added
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {options.length === 0 ? (
            <DropdownMenuItem disabled>No pools yet — create one first</DropdownMenuItem>
          ) : (
            options.map((pool) => (
              <DropdownMenuItem
                key={pool.id}
                onSelect={() => {
                  setError(null);
                  setAdded(null);
                  add.mutate(
                    { poolId: pool.id, postId },
                    {
                      onSuccess: () => setAdded(pool.id),
                      onError: (err) => setError(err.message),
                    },
                  );
                }}
              >
                {pool.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
