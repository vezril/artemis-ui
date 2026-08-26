// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SimilarPosts } from "./similar-posts";
import type { Post, SimilarPost } from "@/lib/api/types";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...rest }, children),
}));

// A controllable stub client so every branch — matches, empty, error — is
// deterministic (the fixture ranker's hash-derived distances are not).
const api = vi.hoisted(() => ({
  similarToPost: vi.fn<(id: string) => Promise<SimilarPost[]>>(),
}));

vi.mock("@/lib/api", () => ({
  getClient: () => ({
    live: false,
    baseUrl: null,
    similarToPost: api.similarToPost,
    async getPost(id: string): Promise<Post> {
      return { id, status: "active", tags: [], score: 0, favorited: false, derivatives: [] };
    },
  }),
}));

beforeEach(() => {
  api.similarToPost.mockReset();
  api.similarToPost.mockResolvedValue([
    { id: "01J8B1", distance: 3 },
    { id: "01J8B2", distance: 9 },
  ]);
});
afterEach(cleanup);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const post: Post = {
  id: "01J8A0",
  status: "active",
  tags: ["1girl"],
  score: 0,
  favorited: false,
  derivatives: [],
};

describe("SimilarPosts", () => {
  it("defers the search until asked — nothing fetched before the button is clicked", () => {
    wrap(<SimilarPosts post={post} />);
    expect(screen.getByRole("button", { name: /find similar/i })).toBeTruthy();
    expect(api.similarToPost).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("renders matches after clicking, linked and never back to the target", async () => {
    wrap(<SimilarPosts post={post} />);
    await userEvent.click(screen.getByRole("button", { name: /find similar/i }));

    const links = await screen.findAllByRole("link");
    expect(links).toHaveLength(2);
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      expect(href.startsWith("/posts/")).toBe(true);
      expect(href).not.toBe(`/posts/${post.id}`);
    }
    expect(api.similarToPost).toHaveBeenCalledWith("01J8A0", undefined);
  });

  it("labels each match with a VISIBLE band + distance (never color- or tooltip-only)", async () => {
    wrap(<SimilarPosts post={post} />);
    await userEvent.click(screen.getByRole("button", { name: /find similar/i }));

    // distance 3 → "near-identical", distance 9 → "loose": both as visible text.
    expect(await screen.findByText("near-identical")).toBeTruthy();
    expect(screen.getByText("loose")).toBeTruthy();
    // And the tile's accessible name carries band + number for screen readers.
    expect(
      screen.getByRole("link", { name: /01J8B1 — near-identical, distance 3/i }),
    ).toBeTruthy();
  });

  it("shows the designed empty state when there are no matches", async () => {
    api.similarToPost.mockResolvedValue([]);
    wrap(<SimilarPosts post={post} />);
    await userEvent.click(screen.getByRole("button", { name: /find similar/i }));
    expect(await screen.findByText(/no near-duplicates found/i)).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows the error state with a Retry button when the search fails", async () => {
    api.similarToPost.mockRejectedValue(new Error("similarity search failed"));
    wrap(<SimilarPosts post={post} />);
    await userEvent.click(screen.getByRole("button", { name: /find similar/i }));

    expect(await screen.findByText(/similarity search failed/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("resets to deferred when remounted for a different post (the key contract)", async () => {
    // post-view keys <SimilarPosts key={post.id}> so navigation remounts it; simulate that.
    const { rerender } = wrap(<SimilarPosts key={post.id} post={post} />);
    await userEvent.click(screen.getByRole("button", { name: /find similar/i }));
    await screen.findAllByRole("link");

    const other: Post = { ...post, id: "01J8Z9" };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SimilarPosts key={other.id} post={other} />
      </QueryClientProvider>,
    );
    // Fresh mount → back to the deferred button; no auto-fired search for the new post.
    expect(screen.getByRole("button", { name: /find similar/i })).toBeTruthy();
    expect(api.similarToPost).not.toHaveBeenCalledWith("01J8Z9", undefined);
  });
});
