"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, Loader2, RotateCw } from "lucide-react";

import { getClient } from "@/lib/api";
import { mediaUrl, thumbnailVariant } from "@/lib/api/media";
import type { UploadRowState } from "@/lib/hooks/use-uploads";
import { Button } from "@/components/ui/button";
import { MediaPlaceholder } from "@/components/catalog/media-placeholder";

/** How often a pending post is re-polled, and the cap before it settles to rest. */
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 20;

/**
 * One upload row. `uploading` shows the only honest indeterminate progress (the byte
 * transfer); a `pending` post is polled via `GET /posts/{id}` under a
 * `["upload-status", id]` key until it turns `active`/`failed`, or — after a bounded
 * number of polls — settles to a resting "still pending" state with a manual refresh
 * (never an endless poll, never a fake processing bar).
 */
export function UploadRow({
  row,
  onStatus,
  onRetry,
}: {
  row: UploadRowState;
  onStatus: (rowId: string, phase: "active" | "failed") => void;
  onRetry: (rowId: string, file: File) => void;
}) {
  const baseUrl = getClient().baseUrl;
  const [polls, setPolls] = React.useState(0);
  const exhausted = polls >= MAX_POLLS;
  const shouldPoll = row.phase === "pending" && !!row.postId;

  const query = useQuery({
    queryKey: ["upload-status", row.postId],
    queryFn: () => getClient().getPost(row.postId as string),
    enabled: shouldPoll,
    refetchInterval: shouldPoll && !exhausted ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    retry: false,
    gcTime: 0,
  });

  // A retry re-uploads to a NEW postId; reset the bound so the fresh post isn't born
  // "exhausted" from the previous attempt's count.
  React.useEffect(() => {
    setPolls(0);
  }, [row.postId]);

  // EVERY settled poll — success OR error — counts toward the bound, so a persistently
  // erroring `getPost` (a transient 502/404/network blip) can't poll forever. A terminal
  // status is reported up to the controller (which flips the phase and stops the poll).
  const dataStamp = query.dataUpdatedAt;
  const errorStamp = query.errorUpdatedAt;
  React.useEffect(() => {
    if (dataStamp === 0 && errorStamp === 0) return;
    setPolls((n) => n + 1);
    const status = query.data?.status;
    if (status === "active" || status === "failed") onStatus(row.rowId, status);
    // Keyed on the settle timestamps so each poll counts once, incl. error polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStamp, errorStamp]);

  const pollErrored = query.isError;

  const post = query.data;
  const thumbVariant = post ? thumbnailVariant(post.derivatives) : null;
  const thumbUrl = thumbVariant ? mediaUrl(baseUrl, post?.md5, thumbVariant.variant) : null;

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border/60">
        {row.phase === "active" && thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- media is arbitrary remote (Apollo gateway) URLs, not Next-optimizable
          <img src={thumbUrl} alt={row.name} className="h-full w-full object-cover" />
        ) : (
          <MediaPlaceholder label={row.postId ?? row.name} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(row.size)}</p>
        <div className="mt-1">
          <StatusArea
            row={row}
            exhausted={exhausted}
            errored={pollErrored}
            onRefresh={() => query.refetch()}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {row.phase === "active" && row.postId && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/posts/${row.postId}`}>View post</Link>
          </Button>
        )}
        {(row.phase === "error" || row.phase === "failed") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetry(row.rowId, row.file)}
          >
            <RotateCw className="size-4" aria-hidden /> Retry
          </Button>
        )}
      </div>
    </li>
  );
}

function StatusArea({
  row,
  exhausted,
  errored,
  onRefresh,
}: {
  row: UploadRowState;
  exhausted: boolean;
  errored: boolean;
  onRefresh: () => void;
}) {
  switch (row.phase) {
    case "queued":
    case "uploading":
      return (
        <div className="flex max-w-[16rem] flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Uploading…
          </span>
          {/* Indeterminate: the byte transfer is the only progress we can honestly show. */}
          <div
            className="h-1 w-full overflow-hidden rounded bg-muted"
            role="progressbar"
            aria-label="Uploading file"
          >
            <div className="h-full w-1/3 animate-pulse rounded bg-primary" />
          </div>
        </div>
      );
    case "pending": {
      // A resting state after the poll bound: distinguish "couldn't reach Artemis to
      // check" (errored) from "still processing" so a network problem isn't mistaken
      // for a slow worker.
      const resting = exhausted;
      return (
        <div className="flex flex-col gap-1">
          <span
            className={`flex items-center gap-1.5 text-xs ${resting && errored ? "text-amber-500" : "text-muted-foreground"}`}
            {...(resting && errored ? { role: "alert" } : {})}
          >
            {resting ? (
              errored ? (
                <AlertCircle className="size-3.5" aria-hidden />
              ) : (
                <Clock className="size-3.5" aria-hidden />
              )
            ) : (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            )}
            {resting && errored ? "Couldn’t check status" : "Pending — awaiting processing"}
          </span>
          {resting && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {errored ? "Couldn’t reach Artemis." : "Still pending after several checks."}
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <RotateCw className="size-3" aria-hidden /> Check again
              </button>
            </span>
          )}
        </div>
      );
    }
    case "active":
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-500">
          <CheckCircle2 className="size-3.5" aria-hidden />
          Active
        </span>
      );
    case "failed":
      return (
        <span role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5" aria-hidden />
          Processing failed
        </span>
      );
    case "error":
      return (
        <span role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5" aria-hidden />
          Upload failed{row.error ? ` — ${row.error}` : ""}
        </span>
      );
  }
}

/** Human-readable byte size (B / KB / MB), for the row's file line. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
