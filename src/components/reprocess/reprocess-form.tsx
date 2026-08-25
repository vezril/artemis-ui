"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, Loader2 } from "lucide-react";

import { getClient } from "@/lib/api";
import { ApiError, type ReprocessKind, type ReprocessSelectMode } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KINDS: ReprocessKind[] = ["derivatives", "metadata", "tags"];

/**
 * The Reprocess form over `POST /reprocess`. Builds `{select, kind}`, gates a broad
 * selection (stale / DSL) behind a confirm step with a best-effort match-count preview,
 * lets a single post submit directly, and reports `{enqueued}` or a 400 `{error}` inline.
 */
export function ReprocessForm() {
  const client = getClient();
  const [mode, setMode] = React.useState<ReprocessSelectMode>("one");
  const [postId, setPostId] = React.useState("");
  const [dsl, setDsl] = React.useState("");
  const [kind, setKind] = React.useState<ReprocessKind>("derivatives");

  const [confirming, setConfirming] = React.useState(false);
  const [preview, setPreview] = React.useState<number | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  // Invalidates an in-flight preview so a late response for an abandoned selection
  // can't overwrite the count shown for the current one.
  const previewSeq = React.useRef(0);

  const select =
    mode === "one" ? `id:${postId.trim()}` : mode === "stale" ? "stale" : dsl.trim();
  const valid = mode === "stale" || (mode === "one" ? postId.trim() !== "" : dsl.trim() !== "");
  const broad = mode !== "one";

  const mutation = useMutation({
    mutationFn: () => client.reprocess({ select, kind }),
  });

  async function onSubmit() {
    mutation.reset();
    if (!broad) {
      mutation.mutate();
      return;
    }
    // Broad selection → confirm first, with a preview when we can compute one.
    setConfirming(true);
    if (mode === "query") {
      const seq = ++previewSeq.current;
      setPreview(null);
      setPreviewing(true);
      const count = await client.previewSelectionCount(select);
      if (seq === previewSeq.current) {
        setPreview(count);
        setPreviewing(false);
      }
    } else {
      setPreview(null);
    }
  }

  function reset() {
    previewSeq.current++; // invalidate any in-flight preview
    setConfirming(false);
    setPreview(null);
    setPreviewing(false);
    mutation.reset();
  }

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? "Request failed"
        : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Reprocess</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Enqueue backfill jobs on Artemis (<code className="text-foreground">POST /reprocess</code>).
        A broad selection is confirmed before it enqueues.
      </p>

      {mutation.isSuccess ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300">
          <CheckCircle2 className="mt-0.5 size-5" />
          <div>
            <p className="font-semibold">Enqueued {mutation.data.enqueued} job(s)</p>
            <p className="mt-0.5 text-sm opacity-90">
              {kind} · <code>{select}</code>
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
              New reprocess
            </Button>
          </div>
        </div>
      ) : null}

      {!mutation.isSuccess ? (
        <div className="space-y-6">
          {/* Selection */}
          <fieldset className="space-y-3" disabled={confirming || mutation.isPending}>
            <legend className="mb-1 text-sm font-medium">Selection</legend>
            <ModeRadio value="one" mode={mode} setMode={setMode} label="One post" hint="by id" />
            {mode === "one" ? (
              <Input
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                placeholder="post id (e.g. 01J2…)"
                aria-label="Post id"
                className="max-w-sm"
              />
            ) : null}
            <ModeRadio value="stale" mode={mode} setMode={setMode} label="Stale" hint="all out-of-date" />
            <ModeRadio value="query" mode={mode} setMode={setMode} label="Query" hint="search DSL" />
            {mode === "query" ? (
              <Input
                value={dsl}
                onChange={(e) => setDsl(e.target.value)}
                placeholder="DSL, e.g.  rating:s -is:animated"
                aria-label="Search DSL query"
                className="max-w-lg"
              />
            ) : null}
          </fieldset>

          {/* Kind */}
          <fieldset disabled={confirming || mutation.isPending}>
            <legend className="mb-2 text-sm font-medium">Kind</legend>
            <div role="radiogroup" aria-label="Reprocess kind" className="flex gap-2">
              {KINDS.map((k) => {
                const selected = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setKind(k)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm capitalize transition-colors ${
                      selected
                        ? "border-primary bg-primary/15 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {selected ? <Check className="size-3.5" aria-hidden="true" /> : null}
                    {k}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {errorMessage ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4" /> {errorMessage}
            </div>
          ) : null}

          {/* Actions / confirm */}
          {!confirming ? (
            <Button onClick={onSubmit} disabled={!valid || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {broad ? "Reprocess…" : "Reprocess"}
            </Button>
          ) : (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="flex items-center gap-2 font-medium text-amber-300">
                <AlertTriangle className="size-4" /> Confirm a broad reprocess
              </p>
              <p className="mt-1 text-sm text-amber-200/90">
                This enqueues <b>{kind}</b> jobs for{" "}
                {mode === "stale" ? (
                  <>all <b>stale</b> posts</>
                ) : (
                  <>
                    posts matching <code>{select}</code>
                    {previewing ? (
                      " (counting…)"
                    ) : preview !== null ? (
                      <> (≥ {preview} on the first page)</>
                    ) : null}
                  </>
                )}
                . This is real work across the media fleet.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Confirm &amp; enqueue
                </Button>
                <Button variant="outline" onClick={reset} disabled={mutation.isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ModeRadio({
  value,
  mode,
  setMode,
  label,
  hint,
}: {
  value: ReprocessSelectMode;
  mode: ReprocessSelectMode;
  setMode: (m: ReprocessSelectMode) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="radio"
        name="select-mode"
        checked={mode === value}
        onChange={() => setMode(value)}
        className="accent-primary"
      />
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">— {hint}</span>
    </label>
  );
}
