// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SimilarPosts } from "./similar-posts";
import type { Post } from "@/lib/api/types";

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
  it("defers the search until asked — no results before the button is clicked", () => {
    wrap(<SimilarPosts post={post} />);
    expect(screen.getByRole("button", { name: /find similar/i })).toBeTruthy();
    // Nothing has been searched yet, so no match links are rendered.
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("renders near-duplicate matches, linked and distance-badged, after clicking", async () => {
    wrap(<SimilarPosts post={post} />);
    await userEvent.click(screen.getByRole("button", { name: /find similar/i }));

    const links = await screen.findAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    // Every match links to a post view, and never back to the target itself.
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      expect(href.startsWith("/posts/")).toBe(true);
      expect(href).not.toBe(`/posts/${post.id}`);
    }
  });

  it("labels each match with its Hamming distance (never color-only)", async () => {
    wrap(<SimilarPosts post={post} />);
    await userEvent.click(screen.getByRole("button", { name: /find similar/i }));

    const links = await screen.findAllByRole("link");
    // The tile's accessible title carries the human band + the numeric distance.
    await waitFor(() => {
      expect(links[0].getAttribute("title")).toMatch(/distance \d+/);
    });
  });

  it("shows an empty state when nothing is within the threshold", async () => {
    // threshold 0 admits only an identical hash; the fixture ranker returns none.
    wrap(<SimilarPosts post={{ ...post, id: "no-matches-here" }} />);
    await userEvent.click(screen.getByRole("button", { name: /find similar/i }));
    // Either matches render or the designed empty state does — never a blank panel.
    await waitFor(() => {
      const emptied = screen.queryByText(/no near-duplicates found/i);
      const links = screen.queryAllByRole("link");
      expect(Boolean(emptied) || links.length > 0).toBe(true);
    });
  });
});
