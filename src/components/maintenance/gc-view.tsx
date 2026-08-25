"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, Search, Trash2 } from "lucide-react";

import { getClient } from "@/lib/api";
import { ApiError, type SweepOutcome } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

/**
 * The garbage-collection view (gc-maintenance): the orphan sweep is dry-run-first (a real run is
 * only offered after a dry-run is shown, behind a confirm), and an on-demand retention purge is
 * confirmed. Both report counts and surface failures inline.
 */
export function GcView() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Garbage collection</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Reclaim failed-upload debris and force a retention purge pass.
      </p>
      <OrphanSweep />
      <RetentionPurge />
    </div>
  );
}

function OrphanSweep() {
  const client = getClient();
  const [dry, setDry] = React.useState<SweepOutcome | null>(null);
  const [real, setReal] = React.useState<SweepOutcome | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState<"dry" | "real" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function sweep(dryRun: boolean) {
    setBusy(dryRun ? "dry" : "real");
    setError(null);
    try {
      const out = await client.orphanSweep(dryRun);
      if (dryRun) {
        setDry(out);
        setReal(null);
      } else {
        setReal(out);
        setDry(null);
        setConfirming(false);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "sweep failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold">Orphan sweep</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Deletes `originals/` blobs not referenced by any post (failed-upload debris). Always dry-run
        first.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => sweep(true)} disabled={busy !== null || confirming}>
          {busy === "dry" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Dry-run
        </Button>
        {dry && dry.orphans > 0 ? (
          <Button onClick={() => setConfirming(true)} disabled={busy !== null || confirming}>
            <Trash2 className="size-4" /> Run real sweep…
          </Button>
        ) : null}
      </div>

      {dry ? (
        <p className="mt-3 text-sm">
          Dry-run: <b>{dry.scanned}</b> scanned, <b>{dry.orphans}</b> orphan(s) would be deleted.
        </p>
      ) : null}

      {confirming ? (
        <div
          role="alertdialog"
          aria-label="Confirm orphan sweep"
          aria-live="assertive"
          className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <AlertTriangle className="size-4" /> Permanently delete {dry?.orphans ?? 0} orphan
            blob(s)?
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="destructive" onClick={() => sweep(false)} disabled={busy !== null}>
              {busy === "real" ? <Loader2 className="size-4 animate-spin" /> : null} Confirm delete
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {real ? (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" /> Swept: {real.deleted} orphan blob(s) deleted.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="size-4" /> {error}
        </p>
      ) : null}
    </section>
  );
}

function RetentionPurge() {
  const client = getClient();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [purged, setPurged] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setPurged(await client.purgeDeleted());
      setConfirming(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "purge pass failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold">Retention purge</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Runs one purge pass now, permanently purging posts already past the retention window.
      </p>

      {!confirming ? (
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => {
            setConfirming(true);
            setPurged(null);
          }}
          disabled={busy}
        >
          <Trash2 className="size-4" /> Run purge pass…
        </Button>
      ) : (
        <div
          role="alertdialog"
          aria-label="Confirm retention purge"
          aria-live="assertive"
          className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <AlertTriangle className="size-4" /> Purge all posts past retention now?
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="destructive" onClick={run} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Confirm purge pass
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {purged !== null ? (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" /> Purged {purged} post(s).
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="size-4" /> {error}
        </p>
      ) : null}
    </section>
  );
}
