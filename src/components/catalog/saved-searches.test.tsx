// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SavedSearches } from "./saved-searches";
import { ApiError, type SavedSearch } from "@/lib/api/types";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const search = vi.hoisted(() => ({ tags: "1girl night" }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search.tags ? { tags: search.tags } : {}),
}));

// Controllable stub client over a mutable saved-search list.
const api = vi.hoisted(() => {
  const state = {
    searches: [] as SavedSearch[],
    failNext: null as string | null,
  };
  function maybeFail(method: string) {
    if (state.failNext === method) {
      state.failNext = null;
      throw new ApiError(`${method} failed`, 500);
    }
  }
  return {
    state,
    listSavedSearches: vi.fn(async () => {
      maybeFail("listSavedSearches");
      return state.searches.map((s) => ({ ...s }));
    }),
    saveSearch: vi.fn(async (name: string, query: string) => {
      maybeFail("saveSearch");
      if (state.searches.some((s) => s.name === name)) {
        throw new ApiError("a search with this name already exists", 409);
      }
      state.searches.push({ name, query });
    }),
    renameSavedSearch: vi.fn(async (from: string, to: string) => {
      maybeFail("renameSavedSearch");
      const e = state.searches.find((s) => s.name === from);
      if (e) e.name = to;
    }),
    deleteSavedSearch: vi.fn(async (name: string) => {
      maybeFail("deleteSavedSearch");
      state.searches = state.searches.filter((s) => s.name !== name);
    }),
  };
});

vi.mock("@/lib/api", () => ({
  getClient: () => ({
    live: false,
    baseUrl: null,
    listSavedSearches: api.listSavedSearches,
    saveSearch: api.saveSearch,
    renameSavedSearch: api.renameSavedSearch,
    deleteSavedSearch: api.deleteSavedSearch,
  }),
}));

beforeEach(() => {
  api.state.searches = [
    { name: "Cat girls", query: "1girl cat_ears" },
    { name: "Best of night", query: "night order:score" },
  ];
  api.state.failNext = null;
  search.tags = "1girl night";
  router.push.mockReset();
  for (const fn of [
    api.listSavedSearches,
    api.saveSearch,
    api.renameSavedSearch,
    api.deleteSavedSearch,
  ]) {
    fn.mockClear();
  }
});
afterEach(cleanup);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("SavedSearches", () => {
  it("lists entries and runs one through the normal search flow (encoded)", async () => {
    const user = userEvent.setup();
    wrap(<SavedSearches />);

    await user.click(await screen.findByRole("button", { name: "Cat girls" }));
    expect(router.push).toHaveBeenCalledWith("/search?tags=1girl%20cat_ears");
  });

  it("saves the current query under a name", async () => {
    const user = userEvent.setup();
    wrap(<SavedSearches />);
    await screen.findByRole("button", { name: "Cat girls" });

    await user.click(screen.getByRole("button", { name: /save current search/i }));
    await user.type(screen.getByRole("textbox", { name: /saved search name/i }), "Tonight");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(api.saveSearch).toHaveBeenCalledWith("Tonight", "1girl night"));
    expect(await screen.findByRole("button", { name: "Tonight" })).toBeTruthy();
  });

  it("surfaces a duplicate-name save error inline and keeps the form open", async () => {
    const user = userEvent.setup();
    wrap(<SavedSearches />);
    await screen.findByRole("button", { name: "Cat girls" });

    await user.click(screen.getByRole("button", { name: /save current search/i }));
    await user.type(screen.getByRole("textbox", { name: /saved search name/i }), "Cat girls");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/already exists/i)).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /saved search name/i })).toBeTruthy();
  });

  it("disables saving when there is no current query", async () => {
    search.tags = "";
    wrap(<SavedSearches />);
    await screen.findByRole("button", { name: "Cat girls" });
    expect(
      screen.getByRole("button", { name: /save current search/i }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("renames optimistically and rolls back with an error on failure", async () => {
    const user = userEvent.setup();
    api.state.failNext = "renameSavedSearch";
    wrap(<SavedSearches />);
    await screen.findByRole("button", { name: "Cat girls" });

    await user.click(screen.getByRole("button", { name: /rename cat girls/i }));
    const input = screen.getByRole("textbox", { name: /new name for cat girls/i });
    await user.clear(input);
    await user.type(input, "Felines{Enter}");

    // Error surfaces and the original name returns (rollback).
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Cat girls" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Felines" })).toBeNull();
  });

  it("deletes only after the two-step confirm", async () => {
    const user = userEvent.setup();
    wrap(<SavedSearches />);
    await screen.findByRole("button", { name: "Cat girls" });

    await user.click(screen.getByRole("button", { name: /delete cat girls/i }));
    expect(api.deleteSavedSearch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /confirm delete cat girls/i }));

    await waitFor(() => expect(api.deleteSavedSearch).toHaveBeenCalledWith("Cat girls"));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Cat girls" })).toBeNull(),
    );
  });

  it("shows the designed empty state", async () => {
    api.state.searches = [];
    wrap(<SavedSearches />);
    expect(await screen.findByText(/nothing saved yet/i)).toBeTruthy();
  });
});
