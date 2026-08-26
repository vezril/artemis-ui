"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { Suggestion } from "@/lib/api/types";
import { useAutocomplete } from "@/lib/hooks/use-catalog";
import { SuggestionList } from "@/components/catalog/suggestion-list";
import { cn } from "@/lib/utils";

/** Normalize a typed tag: lowercase, spaces → underscores, strip DSL operators. */
function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^[-~]+/, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

/**
 * A focused, add-only tag input for the post tag editor. Reuses the search box's
 * grammar-aware autocomplete (`useAutocomplete` + `SuggestionList`) but in **tag
 * context only** — no metatags, no `-`/`~`/`order` operators. Enter, Space, or
 * picking a suggestion adds a plain tag name via `onAdd`; the parent owns the tag
 * set. Suggestions are filtered to real tags so a stray `key:` never inserts a
 * metatag.
 */
export function TagInput({
  onAdd,
  disabled,
  label = "Add a tag",
}: {
  onAdd: (name: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Tag context only — drop any metatag rows the autocomplete may return.
  const suggestions = useAutocomplete(draft).filter(
    (s): s is Extract<Suggestion, { kind: "tag" }> => s.kind === "tag",
  );
  const showSuggestions = focused && draft.trim().length > 0 && suggestions.length > 0;

  /** Change the draft and reset the suggestion highlight together (no sync effect). */
  function updateDraft(value: string) {
    setDraft(value);
    setActiveIndex(-1);
  }

  function add(name: string) {
    const clean = normalizeTag(name);
    // Only real tag names — reject DSL-shaped free text (metatag `key:value`, a
    // wildcard `*`, or any other stray char) so it can't be saved as a literal tag.
    if (!/^[a-z0-9_]+$/.test(clean)) return;
    onAdd(clean);
    updateDraft("");
  }

  function pick(s: Suggestion) {
    add(s.kind === "tag" ? s.name : s.value);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && showSuggestions) {
      e.preventDefault();
      setActiveIndex((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setActiveIndex((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) pick(suggestions[activeIndex]);
      else add(draft);
    } else if (e.key === "Tab" && showSuggestions) {
      e.preventDefault();
      pick(suggestions[Math.max(0, activeIndex)]);
    } else if (e.key === " " && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Escape") {
      updateDraft("");
    }
  }

  return (
    <div className="relative w-full">
      <div className="flex min-h-9 w-full items-center gap-1 rounded-md border border-input bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-ring">
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          onChange={(e) => updateDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Add a tag…"
          aria-label={label}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls="catalog-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            showSuggestions && activeIndex >= 0 ? `catalog-search-opt-${activeIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "h-6 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
            disabled && "opacity-50",
          )}
        />
      </div>

      {showSuggestions && (
        <SuggestionList
          suggestions={suggestions}
          activeIndex={activeIndex}
          onPick={pick}
          onHover={setActiveIndex}
        />
      )}
    </div>
  );
}
