"use client";

import { cn } from "@/lib/utils";
import { useHealth } from "@/lib/hooks/use-health";
import type { ConnectionState } from "@/lib/api/types";
import { getClient } from "@/lib/api";

const LABEL: Record<ConnectionState, string> = {
  up: "Live",
  down: "Down",
  unreachable: "Unreachable",
  fixtures: "Fixtures",
};

const DOT: Record<ConnectionState, string> = {
  up: "bg-emerald-500",
  down: "bg-destructive",
  unreachable: "bg-amber-500",
  fixtures: "bg-muted-foreground",
};

/**
 * Header indicator: which Artemis the console targets and whether it's reachable.
 * The state is always shown as a text label next to the dot (never color-only), and
 * fixture mode is stated plainly so mock data is never mistaken for a live service.
 */
export function ConnectionIndicator() {
  const { connection, health } = useHealth();
  const baseUrl = getClient().baseUrl;

  const target = baseUrl ?? "built-in fixtures";
  const version = health?.version ? `v${health.version}` : undefined;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn("inline-block size-2 rounded-full", DOT[connection])}
        aria-hidden="true"
      />
      <span className="font-medium">{LABEL[connection]}</span>
      <span className="hidden text-muted-foreground sm:inline" title={target}>
        · {truncate(target)}
        {version ? ` · ${version}` : ""}
      </span>
    </div>
  );
}

function truncate(s: string, max = 40): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
