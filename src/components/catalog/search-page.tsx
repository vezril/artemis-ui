"use client";

import { useSearchParams } from "next/navigation";

import type { OrderKey } from "@/lib/api/types";
import { DEFAULT_ORDER } from "@/lib/catalog/dsl";
import { SearchBox } from "@/components/catalog/search-box";
import { OrderControl } from "@/components/catalog/order-control";
import { Gallery } from "@/components/catalog/gallery";
import { FacetStrip } from "@/components/catalog/facet-strip";

/**
 * The search + gallery surface. The DSL query and order live in the URL
 * (`?tags=&order=`), so tag/facet clicks navigate and re-run the search. A
 * sidebar shows the tags-in-results facets; the main column is the gallery.
 */
export function SearchPage() {
  const params = useSearchParams();
  const tags = params.get("tags") ?? "";
  const order = (params.get("order") as OrderKey | null) ?? DEFAULT_ORDER;

  return (
    <div className="mx-auto max-w-[1800px] px-3 py-4 sm:px-4">
      <div className="mb-4 flex items-start gap-2">
        <SearchBox className="flex-1" />
        <OrderControl />
      </div>

      <div className="flex gap-4">
        <aside className="hidden w-56 shrink-0 lg:block">
          <h2 className="mb-2 px-1.5 text-sm font-semibold text-muted-foreground">
            Tags in results
          </h2>
          <FacetStrip tags={tags} order={order} />
        </aside>

        <div className="min-w-0 flex-1">
          <Gallery tags={tags} order={order} />
        </div>
      </div>
    </div>
  );
}
