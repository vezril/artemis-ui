// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Gallery } from "./gallery";
import { PostView } from "./post-view";

// next/link needs the App Router context to render; stub it to a plain anchor so
// these components render standalone (we only assert on rendered output, not nav).
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

describe("Gallery — renders tiles from a fixture page", () => {
  it("renders one linked tile per fixture post", async () => {
    wrap(<Gallery tags="" order="id" />);
    const links = await screen.findAllByRole("link");
    const postLinks = links.filter((a) => a.getAttribute("href")?.startsWith("/posts/"));
    // The fixture set has several active posts; each tile links to its post view.
    expect(postLinks.length).toBeGreaterThanOrEqual(5);
  });

  it("shows a placeholder (not a broken img) in fixture mode", async () => {
    wrap(<Gallery tags="" order="id" />);
    // No live media server, so every tile falls back to the labelled placeholder.
    const placeholders = await screen.findAllByRole("img", { name: /no media available/i });
    expect(placeholders.length).toBeGreaterThanOrEqual(1);
  });
});

describe("PostView — missing post", () => {
  it("renders a not-found state for an unknown id (404)", async () => {
    wrap(<PostView id="does-not-exist" />);
    expect(await screen.findByText(/post not found/i)).toBeTruthy();
  });
});
