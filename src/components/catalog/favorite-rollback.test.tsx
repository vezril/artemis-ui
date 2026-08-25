// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Post } from "@/lib/api/types";
import { ApiError } from "@/lib/api/types";
import { PostView } from "./post-view";

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

// A stub Artemis client whose `setFavorite` always fails — so we can assert the
// optimistic star reverts and the error surfaces. `getPost` stays consistent
// (favorited:false) so the post-settle refetch agrees with the rollback.
const STUB_POST: Post = {
  id: "stub-1",
  status: "active",
  tags: ["1girl"],
  rating: "s",
  score: 10,
  favorited: false,
  derivatives: [],
  filetype: "png",
};

vi.mock("@/lib/api", () => ({
  getClient: () => ({
    live: false,
    baseUrl: null,
    getPost: async () => ({ ...STUB_POST, tags: [...STUB_POST.tags] }),
    autocomplete: async () => [],
    setFavorite: async () => {
      throw new ApiError("nope", 500);
    },
    scorePost: async () => undefined,
    setRating: async () => undefined,
    patchTags: async () => undefined,
  }),
}));

afterEach(cleanup);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Favorite — optimistic rollback on error", () => {
  it("reverts the star and shows an error when setFavorite fails", async () => {
    const user = userEvent.setup();
    wrap(<PostView id="stub-1" />);

    const favBtn = await screen.findByRole("button", { name: /^favorite$/i });
    expect(favBtn.getAttribute("aria-pressed")).toBe("false");

    await user.click(favBtn);

    // The mutation rejects → rollback to unfavorited + an inline error.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("button", { name: /^favorite$/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});
