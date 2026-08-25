// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

afterEach(cleanup);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Tag editor — add and save", () => {
  it("adds a tag and Save patches the post so the sidebar shows it", async () => {
    const user = userEvent.setup();
    // 01J8A5 is a fixture post; a fresh store means this id starts from its base tags.
    wrap(<PostView id="01J8A5" />);

    // Enter edit mode.
    await user.click(await screen.findByRole("button", { name: /edit tags/i }));

    // Add a brand-new tag via the focused tag input.
    const input = screen.getByRole("combobox", { name: /add a tag/i });
    await user.type(input, "sunset{Enter}");

    // The working set shows it as a removable chip.
    expect(await screen.findByText("sunset")).toBeTruthy();

    // Save → optimistic + fixture patch; the editor closes back to the read view.
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // Back on the read sidebar, the saved tag is present (as a search link).
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit tags/i })).toBeTruthy(),
    );
    const links = screen.getAllByRole("link");
    expect(links.some((a) => within(a).queryByText("sunset"))).toBe(true);
  });

  it("rejects DSL-shaped free text (a metatag) instead of adding it as a tag", async () => {
    const user = userEvent.setup();
    wrap(<PostView id="01J8A6" />);
    await user.click(await screen.findByRole("button", { name: /edit tags/i }));

    const input = screen.getByRole("combobox", { name: /add a tag/i });
    // A `key:value` metatag has no tag suggestion; Enter must NOT add it as a literal tag.
    await user.type(input, "rating:e{Enter}");

    expect(screen.queryByText("rating:e")).toBeNull();
    // The input keeps the rejected text (nothing was added), so the operator can fix it.
    expect((input as HTMLInputElement).value).toBe("rating:e");
  });
});
