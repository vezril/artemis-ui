"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { parseTerm, parseTerms } from "@/lib/catalog/dsl";
import type { OrderKey, Suggestion } from "@/lib/api/types";
import { searchHref } from "@/lib/catalog/query";
import { useAutocomplete, useTagCategories } from "@/lib/hooks/use-catalog";
import { SearchChip } from "@/components/catalog/search-chip";
import { SuggestionList } from "@/components/catalog/suggestion-list";
import { cn } from "@/lib/utils";

/** Preserve any leading `-`/`~` operator from the draft when inserting a completion. */
function opPrefix(draft: string): string {
  let prefix = "";
  let v = draft;
  if (v.startsWith("-")) {
    prefix += "-";
    v = v.slice(1);
  }
  if (v.startsWith("~")) prefix += "~";
  return prefix;
}

/**
 * The grammar-aware search input: committed terms as removable chips plus a draft
 * field with context-switching autocomplete. Every commit/removal writes the DSL
 * to the URL, which re-runs the gallery search.
 */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const order = (params.get("order") as OrderKey | null) ?? null;
  const currentTags = params.get("tags") ?? "";
  const terms = React.useMemo(() => parseTerms(currentTags), [currentTags]);

  const [draft, setDraft] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const suggestions = useAutocomplete(draft);
  const showSuggestions = focused && draft.trim().length > 0 && suggestions.length > 0;

  // Resolve categories for committed non-metatag terms (chip coloring).
  const tagNames = React.useMemo(
    () =>
      terms
        .map((t) => parseTerm(t))
        .filter((p) => !p.metatag)
        .map((p) => p.value),
    [terms],
  );
  const categories = useTagCategories(tagNames);

  React.useEffect(() => setActiveIndex(-1), [draft]);

  function navigate(nextTerms: string[]) {
    router.push(searchHref(nextTerms.join(" "), order));
  }

  function commitRaw(term: string) {
    const t = term.trim();
    if (!t) return;
    if (!terms.includes(t)) navigate([...terms, t]);
    setDraft("");
  }

  function pick(s: Suggestion) {
    const prefix = opPrefix(draft);
    const term = s.kind === "tag" ? `${prefix}${s.name}` : `${prefix}${s.value}`;
    commitRaw(term);
    inputRef.current?.focus();
  }

  function removeAt(index: number) {
    navigate(terms.filter((_, i) => i !== index));
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
      else commitRaw(draft);
    } else if (e.key === "Tab" && showSuggestions) {
      e.preventDefault();
      pick(suggestions[Math.max(0, activeIndex)]);
    } else if (e.key === " " && draft.trim()) {
      // Space separates terms in the DSL — commit the current token.
      e.preventDefault();
      commitRaw(draft);
    } else if (e.key === "Backspace" && draft === "" && terms.length > 0) {
      e.preventDefault();
      removeAt(terms.length - 1);
    } else if (e.key === "Escape") {
      setDraft("");
      inputRef.current?.blur();
    }
  }

  return (
    <div className={cn("relative w-full", className)} role="search">
      <div
        className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        {terms.map((term, i) => {
          const parsed = parseTerm(term);
          return (
            <SearchChip
              key={`${term}-${i}`}
              term={term}
              category={parsed.metatag ? undefined : categories[parsed.value]}
              onRemove={() => removeAt(i)}
            />
          );
        })}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={terms.length === 0 ? "Search tags…  (try: 1girl cat_ears -night)" : ""}
          aria-label="Search posts by tags"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls="catalog-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            showSuggestions && activeIndex >= 0 ? `catalog-search-opt-${activeIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          className="h-6 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
