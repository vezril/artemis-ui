"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Flame, Loader2, RotateCcw, Trash2 } from "lucide-react";

import { getClient } from "@/lib/api";
import { ApiError, type PostStatusResult, type PurgeOutcome } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Result =
  | { kind: "status"; value: PostStatusResult }
  | { kind: "purge"; value: PurgeOutcome };

/**
 * The per-post deletion-lifecycle view (post-lifecycle): soft-delete / restore / hard-purge a post
 * by id. Delete and purge are destructive and confirmed; restore submits directly. Results and
 * errors report inline.
 */
export function PostAdminView() {
  const client = getClient();
  const [id, setId] = React.useState("");
  const [confirm, setConfirm] = React.useState<null | "delete" | "purge">(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = id.trim();
  const valid = trimmed !== "";

  async function run(fn: () => Promise<Result>) {
    setBusy(true);
    setError(null);
    setResult(null);
    setConfirm(null);
    try {
      setResult(await fn());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  const doRestore = () =>
    run(async () => ({ kind: "status", value: await client.restorePost(trimmed) }));
  const doDelete = () =>
    run(async () => ({ kind: "status", value: await client.deletePost(trimmed) }));
  const doPurge = () =>
    run(async () => ({ kind: "purge", value: await client.purgePost(trimmed) }));

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Posts</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Soft-delete, restore, or permanently purge a single post by id.
      </p>

      <Input
        value={id}
        onChange={(e) => {
          setId(e.target.value);
          setConfirm(null);
        }}
        placeholder="post id (e.g. 01J2…)"
        aria-label="Post id"
        className="max-w-sm"
        disabled={busy}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setConfirm("delete")} disabled={!valid || busy}>
          <Trash2 className="size-4" /> Soft-delete
        </Button>
        <Button variant="outline" onClick={doRestore} disabled={!valid || busy}>
          <RotateCcw className="size-4" /> Restore
        </Button>
        <Button variant="outline" onClick={() => setConfirm("purge")} disabled={!valid || busy}>
          <Flame className="size-4" /> Purge…
        </Button>
        {busy ? <Loader2 className="size-5 animate-spin self-center text-muted-foreground" /> : null}
      </div>

      {confirm ? (
        <div
          role="alertdialog"
          aria-label={confirm === "purge" ? "Confirm purge" : "Confirm soft-delete"}
          aria-live="assertive"
          className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <p className="flex items-center gap-2 font-medium text-amber-300">
            <AlertTriangle className="size-4" />
            {confirm === "purge" ? "Permanently purge this post?" : "Soft-delete this post?"}
          </p>
          <p className="mt-1 text-sm text-amber-200/90">
            {confirm === "purge" ? (
              <>
                Purging <code>{trimmed}</code> deletes its stored blobs. This cannot be undone.
              </>
            ) : (
              <>
                Soft-deleting <code>{trimmed}</code> hides it from browse/search; it can be restored.
              </>
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="destructive"
              onClick={confirm === "purge" ? doPurge : doDelete}
              disabled={busy}
            >
              {confirm === "purge" ? "Confirm purge" : "Confirm delete"}
            </Button>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="size-4" /> {error}
        </div>
      ) : null}

      {result ? (
        <div
          role="status"
          className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300"
        >
          <CheckCircle2 className="mt-0.5 size-5" />
          <div>
            {result.kind === "status" ? (
              <p className="font-semibold">
                Post <code>{result.value.id}</code> → status{" "}
                <span className="font-mono">{result.value.status}</span>
              </p>
            ) : result.value.purged ? (
              <p className="font-semibold">
                Purged — {result.value.blobsDeleted} blob(s) deleted
              </p>
            ) : (
              <p className="font-semibold">
                Nothing purged (the post was not soft-deleted) — 0 blobs deleted
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
