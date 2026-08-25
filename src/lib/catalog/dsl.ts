/**
 * The Artemis search DSL, as far as the UI needs to parse it: space-separated
 * terms, each optionally negated (`-tag`), OR-grouped (`~tag`), a wildcard
 * (`*`), or a metatag (`key:value`). The autocomplete input parses only the
 * term under the cursor to choose tag vs metatag context.
 */
import type { MetatagSuggestion, OrderKey } from "@/lib/api/types";

export const RATING_LABELS: Record<string, string> = {
  g: "General",
  s: "Sensitive",
  q: "Questionable",
  e: "Explicit",
};

export interface OrderOption {
  key: OrderKey;
  label: string;
}

export const ORDER_OPTIONS: OrderOption[] = [
  { key: "id", label: "Newest" },
  { key: "score", label: "Score" },
  { key: "favcount", label: "Favorites" },
  { key: "duration", label: "Duration" },
  { key: "random", label: "Random" },
];

export const DEFAULT_ORDER: OrderKey = "id";

/**
 * Metatags whose values are a known enum (drive metatag-context autocomplete). NOTE: `order` is
 * deliberately NOT here — sort is a separate URL param driven by the OrderControl, so suggesting an
 * `order:` DSL term would be a no-op the search ignores (it isn't sent to `GET /posts?tags=`).
 */
export const METATAG_ENUMS: Record<string, MetatagSuggestion[]> = {
  rating: Object.entries(RATING_LABELS).map(([v, label]) => ({
    kind: "metatag",
    value: `rating:${v}`,
    label: `rating:${v}`,
    description: label,
  })),
};

/** Metatags that take free-form values; still worth suggesting the key. */
export const FREEFORM_METATAGS = ["source", "parent", "pool", "width", "height", "score"];

const KNOWN_METATAGS = new Set([...Object.keys(METATAG_ENUMS), ...FREEFORM_METATAGS]);

/** Split a raw DSL string into whitespace-separated terms. */
export function parseTerms(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean);
}

export interface ParsedTerm {
  raw: string;
  /** The bare tag/metatag with any leading operator stripped. */
  value: string;
  negated: boolean;
  or: boolean;
  metatag?: { key: string; value: string };
}

export function parseTerm(raw: string): ParsedTerm {
  let value = raw;
  const negated = value.startsWith("-");
  if (negated) value = value.slice(1);
  const or = value.startsWith("~");
  if (or) value = value.slice(1);

  const colon = value.indexOf(":");
  const metatag =
    colon > 0 ? { key: value.slice(0, colon), value: value.slice(colon + 1) } : undefined;

  return { raw, value, negated, or, metatag };
}

export type DraftContext =
  | { kind: "tag"; query: string }
  | { kind: "metatag"; key: string; query: string };

/**
 * Decide what the user is typing so autocomplete can switch context. Strips a
 * leading `-`/`~`, then: a `key:` where `key` is a known metatag → metatag
 * context; anything else → tag context.
 */
export function draftContext(draft: string): DraftContext {
  let value = draft;
  if (value.startsWith("-")) value = value.slice(1);
  if (value.startsWith("~")) value = value.slice(1);

  const colon = value.indexOf(":");
  if (colon > 0) {
    const key = value.slice(0, colon).toLowerCase();
    if (KNOWN_METATAGS.has(key)) {
      return { kind: "metatag", key, query: value.toLowerCase() };
    }
  }
  return { kind: "tag", query: value };
}
