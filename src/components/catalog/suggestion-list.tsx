"use client";

import { ArrowRight } from "lucide-react";

import type { Suggestion } from "@/lib/api/types";
import { TagLabel } from "@/components/catalog/tag-label";
import { cn } from "@/lib/utils";

/**
 * The autocomplete dropdown. Tag rows show a category color + count and an alias
 * hint (antecedent → consequent); metatag rows show the enum value and meaning.
 * `activeIndex` is the keyboard-highlighted row.
 */
export function SuggestionList({
  suggestions,
  activeIndex,
  onPick,
  onHover,
}: {
  suggestions: Suggestion[];
  activeIndex: number;
  onPick: (s: Suggestion) => void;
  onHover: (index: number) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <ul
      role="listbox"
      id="catalog-search-listbox"
      className="absolute left-0 top-full z-50 mt-1 max-h-80 w-full min-w-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
    >
      {suggestions.map((s, i) => {
        const key = s.kind === "tag" ? `tag:${s.name}:${s.aliasOf ?? ""}:${i}` : s.value;
        return (
          <li key={key} id={`catalog-search-opt-${i}`} role="option" aria-selected={i === activeIndex}>
            <button
              type="button"
              // onMouseDown (not onClick) so the input doesn't blur first.
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(s);
              }}
              onMouseEnter={() => onHover(i)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left",
                i === activeIndex ? "bg-accent" : "hover:bg-accent/60",
              )}
            >
              {s.kind === "tag" ? (
                <>
                  <TagLabel name={s.name} category={s.category} count={s.postCount} />
                  {s.aliasOf && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {s.aliasOf}
                      <ArrowRight className="size-3" />
                      {s.name}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-mono text-sm">{s.label}</span>
                  {s.description && (
                    <span className="text-xs text-muted-foreground">{s.description}</span>
                  )}
                </>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
