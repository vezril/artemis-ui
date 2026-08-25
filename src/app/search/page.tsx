import { Suspense } from "react";
import type { Metadata } from "next";

import { SearchPage } from "@/components/catalog/search-page";

export const metadata: Metadata = { title: "Search" };

// The search surface reads `?tags=&order=` via useSearchParams, which requires a
// Suspense boundary in the App Router.
export default function Search() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}
