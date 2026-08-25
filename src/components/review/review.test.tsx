// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ReviewView } from "./review-view";

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

// A controllable stub Artemis client: a mutable review backlog, a spied
// `reviewPost`, and an `autocomplete` that resolves each tag's category.
const api = vi.hoisted(() => ({
  reviewPost: vi.fn<(id: string, accept: string[]) => Promise<void>>(),
  state: {
    queue: [] as { postId: string; suggestions: { tag: string; confidence: number; source: string }[] }[],
    failPostId: null as string | null,
  },
}));

vi.mock("@/lib/api", () => ({
  getClient: () => ({
    live: false,
    baseUrl: null,
    async getReviewQueue() {
      return api.state.queue.map((i) => ({
        postId: i.postId,
        suggestions: i.suggestions.map((s) => ({ ...s })),
      }));
    },
    reviewPost: api.reviewPost,
    async autocomplete(q: string) {
      // Every tag resolves as a general (category 0) exact match.
      return [{ kind: "tag", name: q, category: 0, postCount: 1 }];
    },
  }),
}));

beforeEach(() => {
  api.state.queue = [
    {
      postId: "p1",
      suggestions: [
        { tag: "alpha", confidence: 0.9, source: "wd-tagger" },
        { tag: "beta", confidence: 0.5, source: "ram++" },
      ],
    },
    {
      postId: "p2",
      suggestions: [{ tag: "gamma", confidence: 0.8, source: "wd-tagger" }],
    },
  ];
  api.state.failPostId = null;
  api.reviewPost.mockReset();
  api.reviewPost.mockImplementation(async (id: string) => {
    if (api.state.failPostId === id) throw new Error("resolve failed");
    api.state.queue = api.state.queue.filter((i) => i.postId !== id);
  });
});
afterEach(cleanup);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function cardFor(postId: string) {
  const heading = screen.getByText(`Post ${postId}`);
  const article = heading.closest("article");
  if (!article) throw new Error(`no card for ${postId}`);
  return within(article);
}

describe("Review view", () => {
  it("Accept posts only the still-checked tags and removes the card", async () => {
    const user = userEvent.setup();
    wrap(<ReviewView />);

    await screen.findByText("Post p1");

    // Uncheck "beta"; "alpha" stays checked.
    const card = cardFor("p1");
    await user.click(card.getByRole("checkbox", { name: /beta/i }));
    await user.click(card.getByRole("button", { name: /accept/i }));

    expect(api.reviewPost).toHaveBeenCalledWith("p1", ["alpha"]);
    await waitFor(() => expect(screen.queryByText("Post p1")).toBeNull());
    // The other card stays.
    expect(screen.getByText("Post p2")).toBeTruthy();
  });

  it("Reject all posts an empty accept and removes the card", async () => {
    const user = userEvent.setup();
    wrap(<ReviewView />);

    await screen.findByText("Post p2");
    await user.click(cardFor("p2").getByRole("button", { name: /reject all/i }));

    await waitFor(() => expect(api.reviewPost).toHaveBeenCalledWith("p2", []));
    await waitFor(() => expect(screen.queryByText("Post p2")).toBeNull());
  });

  it("a failed resolve re-inserts the card and shows an error", async () => {
    const user = userEvent.setup();
    api.state.failPostId = "p1";
    wrap(<ReviewView />);

    await screen.findByText("Post p1");
    await user.click(cardFor("p1").getByRole("button", { name: /accept/i }));

    // The card comes back with a per-card error.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("Post p1")).toBeTruthy();
    expect(cardFor("p1").getByRole("alert").textContent).toMatch(/resolve failed/i);
  });

  it("shows an empty state when the queue is empty", async () => {
    api.state.queue = [];
    wrap(<ReviewView />);
    expect(await screen.findByText(/all caught up/i)).toBeTruthy();
  });
});
