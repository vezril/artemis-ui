"use client";

import { AlertTriangle, CheckCircle2, Loader2, WifiOff } from "lucide-react";

import { useHealth } from "@/lib/hooks/use-health";
import { getClient } from "@/lib/api";

/**
 * The Health view over `GET /health`. Shows UP/DOWN (color + text label), service,
 * and version, polled ~5s; a DOWN (503) banner and an "unreachable" (transport
 * failure) state are visibly distinct.
 */
export function HealthView() {
  const { health, connection, isLoading, unreachable } = useHealth();
  const baseUrl = getClient().baseUrl;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Health</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {baseUrl ? (
          <>
            Liveness of <code className="text-foreground">{baseUrl}</code>, polled every 5s.
          </>
        ) : (
          <>Fixture mode — no live Artemis configured (set NEXT_PUBLIC_ARTEMIS_BASE_URL).</>
        )}
      </p>

      {unreachable ? (
        <Banner
          tone="warn"
          icon={<WifiOff className="size-5" />}
          title="Unreachable"
          detail="Could not reach Artemis at all (connection refused or timed out). This is different from the service reporting itself DOWN."
        />
      ) : connection === "down" ? (
        <Banner
          tone="down"
          icon={<AlertTriangle className="size-5" />}
          title="Service DOWN"
          detail="Artemis returned 503 — readiness has been withdrawn (e.g. shutting down or a dependency is unavailable)."
        />
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Status">
          <StatusPill connection={connection} isLoading={isLoading} status={health?.status} />
        </Stat>
        <Stat label="Service">
          <span className="font-mono">{health?.service ?? "—"}</span>
        </Stat>
        <Stat label="Version">
          <span className="font-mono">{health?.version ?? "—"}</span>
        </Stat>
      </div>
    </div>
  );
}

function StatusPill({
  connection,
  isLoading,
  status,
}: {
  connection: string;
  isLoading: boolean;
  status?: string;
}) {
  if (isLoading)
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Checking…
      </span>
    );
  if (connection === "up")
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-400">
        <CheckCircle2 className="size-4" /> UP
      </span>
    );
  if (connection === "fixtures")
    return <span className="inline-flex items-center gap-1.5 text-muted-foreground">Fixtures</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-destructive">
      <AlertTriangle className="size-4" /> {status ?? connection.toUpperCase()}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-lg">{children}</div>
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  detail,
}: {
  tone: "warn" | "down";
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  const color =
    tone === "down"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return (
    <div className={`flex gap-3 rounded-lg border p-4 ${color}`}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm opacity-90">{detail}</p>
      </div>
    </div>
  );
}
