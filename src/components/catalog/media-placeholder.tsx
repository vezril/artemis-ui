import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The stand-in shown when a post has no usable media ref (a pending post, or
 * fixture mode with no live media server). It is keyed on the md5/variant text so
 * it is stable and never emits a broken `<img>` src.
 */
export function MediaPlaceholder({
  label,
  className,
}: {
  /** A short caption, e.g. the md5 or variant name. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label ? `No media available (${label})` : "No media available"}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/60 p-2 text-center text-muted-foreground",
        className,
      )}
    >
      <ImageOff className="size-5 opacity-70" aria-hidden />
      {label && <span className="max-w-full truncate font-mono text-[10px]">{label}</span>}
    </div>
  );
}
