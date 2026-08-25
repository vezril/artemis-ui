import { Skeleton } from "@/components/ui/skeleton";

// A spread of aspect ratios so skeletons echo the masonry's mixed heights.
const RATIOS = [1, 1.4, 0.75, 1.6, 1, 0.66, 1.2, 0.85, 1.5, 1, 1.3, 0.7];

export function GallerySkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5 [&>*]:mb-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-full break-inside-avoid"
          style={{ aspectRatio: `1 / ${RATIOS[i % RATIOS.length]}` }}
        />
      ))}
    </div>
  );
}
