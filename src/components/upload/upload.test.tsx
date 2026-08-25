// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { UploadsView } from "./uploads-view";

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

// Controllable stub Artemis client: `upload` succeeds (→ pending) or fails per the
// hoisted flag, and `getPost` returns `pending` until it has been polled at least
// twice, then `active` — so a test drives pending→active by advancing polls
// (mount poll + a manual invalidate) rather than by real timers.
const state = vi.hoisted(() => ({ uploadShouldFail: false, getPostCalls: 0 }));

vi.mock("@/lib/api", () => ({
  getClient: () => ({
    live: false,
    baseUrl: null,
    async upload() {
      if (state.uploadShouldFail) throw new Error("bad gateway");
      return { postId: "up-1", status: "pending" };
    },
    async getPost(id: string) {
      state.getPostCalls += 1;
      return {
        id,
        status: state.getPostCalls >= 2 ? "active" : "pending",
        tags: [],
        score: 0,
        favorited: false,
        derivatives: [{ kind: "thumbnail", variant: "thumb.webp" }],
      };
    },
  }),
}));

beforeEach(() => {
  state.uploadShouldFail = false;
  state.getPostCalls = 0;
});
afterEach(cleanup);

function wrap(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...utils, queryClient };
}

function pngFile(name = "photo.png"): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: "image/png" });
}

describe("Uploads view — upload lifecycle", () => {
  it("shows a pending row that becomes active as the post is polled", async () => {
    const user = userEvent.setup();
    const { queryClient } = wrap(<UploadsView />);

    const input = screen.getByLabelText(/choose image or video files/i);
    await user.upload(input, pngFile());

    // The 201 lands → the row is pending (awaiting processing), not a fake progress bar.
    expect(await screen.findByText(/pending — awaiting processing/i)).toBeTruthy();

    // Let the mount poll run (first getPost → still pending), then advance one poll
    // deterministically — the second getPost flips the fixture to active.
    await waitFor(() => expect(state.getPostCalls).toBeGreaterThanOrEqual(1));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["upload-status"] });
    });

    expect(await screen.findByText(/^active$/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /view post/i });
    expect(link.getAttribute("href")).toBe("/posts/up-1");
  });

  it("shows the error and a Retry when the upload fails", async () => {
    const user = userEvent.setup();
    state.uploadShouldFail = true;
    wrap(<UploadsView />);

    const input = screen.getByLabelText(/choose image or video files/i);
    await user.upload(input, pngFile("broken.png"));

    // The failed upload surfaces on its own row (role=alert) with a retry.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/upload failed/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });
});
