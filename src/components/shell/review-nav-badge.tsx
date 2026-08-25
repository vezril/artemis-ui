"use client";

import { useReviewCount } from "@/lib/hooks/use-review";
import { cn } from "@/lib/utils";

/**
 * The needs-review count badge on the Review nav entry. Reads the shared
 * `["review"]` query (same cache the Review view uses, so it's app-wide and
 * fires no extra fetch) and shows the queue length. Zero → nothing rendered.
 *
 * Accessibility: the count is small and numeric, so it carries an explicit
 * `aria-label` ("N posts awaiting review") rather than relying on the bare digit.
 */
export function ReviewNavBadge({ className }: { className?: string }) {
  const count = useReviewCount();
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground",
        className,
      )}
      aria-label={`${count} post${count === 1 ? "" : "s"} awaiting review`}
    >
      {count}
    </span>
  );
}
