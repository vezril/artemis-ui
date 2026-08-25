/**
 * The tag categories. Artemis sends a category as a **number** on the wire; this
 * maps it to a display name and the shared color tokens from `globals.css`. Color
 * is the one loud thing in the catalog UI, but it is ALWAYS paired with a text
 * label here (never color-only) for accessibility.
 *
 * Numbers follow the Danbooru convention (verified against muses-ui):
 *   0 general · 1 artist · 3 copyright · 4 character · 5 meta
 * (2 is unused.) Unknown numbers fall back to `general`.
 */
export type CategoryKey = "general" | "artist" | "copyright" | "character" | "meta";

export interface CategoryMeta {
  /** The Artemis category number. */
  number: number;
  key: CategoryKey;
  /** Human label shown alongside the color. */
  label: string;
  /** Tailwind text-color class bound to the category CSS var. */
  text: string;
  /** Tailwind background-color class bound to the category CSS var. */
  bg: string;
  /** Tailwind border-color class bound to the category CSS var. */
  border: string;
}

const META: Record<CategoryKey, CategoryMeta> = {
  general: {
    number: 0,
    key: "general",
    label: "General",
    text: "text-category-general",
    bg: "bg-category-general",
    border: "border-category-general",
  },
  artist: {
    number: 1,
    key: "artist",
    label: "Artist",
    text: "text-category-artist",
    bg: "bg-category-artist",
    border: "border-category-artist",
  },
  copyright: {
    number: 3,
    key: "copyright",
    label: "Copyright",
    text: "text-category-copyright",
    bg: "bg-category-copyright",
    border: "border-category-copyright",
  },
  character: {
    number: 4,
    key: "character",
    label: "Character",
    text: "text-category-character",
    bg: "bg-category-character",
    border: "border-category-character",
  },
  meta: {
    number: 5,
    key: "meta",
    label: "Meta",
    text: "text-category-meta",
    bg: "bg-category-meta",
    border: "border-category-meta",
  },
};

const BY_NUMBER = new Map<number, CategoryMeta>(
  Object.values(META).map((m) => [m.number, m]),
);

/** Resolve a category number to its metadata (unknown → general). */
export function categoryMeta(category: number): CategoryMeta {
  return BY_NUMBER.get(category) ?? META.general;
}

/**
 * The canonical display order for grouped tag lists (artist → copyright →
 * character → general → meta), matching the classic booru sidebar order.
 */
export const CATEGORY_ORDER: number[] = [
  META.artist.number,
  META.copyright.number,
  META.character.number,
  META.general.number,
  META.meta.number,
];
