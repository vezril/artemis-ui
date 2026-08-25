/** Helpers for reading and mutating the search surface's URL query state. */
import type { OrderKey } from "@/lib/api/types";
import { DEFAULT_ORDER, parseTerms } from "./dsl";

/** Build the `/search` href for a given tag DSL string + order. */
export function searchHref(tags: string, order?: OrderKey | null): string {
  const params = new URLSearchParams();
  const trimmed = tags.trim();
  if (trimmed) params.set("tags", trimmed);
  if (order && order !== DEFAULT_ORDER) params.set("order", order);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/** Add a term to a query string (no-op if already present). */
export function addTerm(tags: string, term: string): string {
  const terms = parseTerms(tags);
  if (terms.includes(term)) return tags.trim();
  return [...terms, term].join(" ");
}

/** Remove a term from a query string. */
export function removeTerm(tags: string, term: string): string {
  return parseTerms(tags)
    .filter((t) => t !== term)
    .join(" ");
}
