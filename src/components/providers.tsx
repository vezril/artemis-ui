"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/types";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client-side providers: TanStack Query (client cache, infinite scroll,
 * optimistic mutations) and the Radix tooltip provider. Kept in one client
 * component so the root layout can stay a server component.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Media catalog changes slowly; keep pages warm and avoid refetch storms.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Retry once for transport-ish failures, but NEVER for 4xx — a 404 is
            // a deterministic answer, and retrying it also opens TanStack's
            // pause-while-unfocused/offline window, which turns "pool not found"
            // into a skeleton that never resolves in a background tab.
            retry: (failureCount, error) =>
              failureCount < 1 &&
              !(error instanceof ApiError && error.status >= 400 && error.status < 500),
            // Never let TanStack's online heuristic pause work. Everything here is
            // same-origin (the BFF) or in-process (fixtures), and a spurious
            // `offline` event otherwise latches the onlineManager and leaves
            // queries `paused` forever — a stuck skeleton instead of an honest
            // error state. Real transport failures still surface as errors.
            networkMode: "always",
          },
          mutations: {
            networkMode: "always",
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
