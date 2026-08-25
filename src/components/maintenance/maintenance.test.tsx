// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GcView } from "./gc-view";
import { PostAdminView } from "./post-admin-view";

// The fixture client is a module singleton, so tests use distinct post ids to avoid state bleed.
afterEach(cleanup);

describe("GcView — dry-run-first safety", () => {
  it("does not offer a real sweep before a dry-run", () => {
    render(<GcView />);
    expect(screen.queryByRole("button", { name: /run real sweep/i })).toBeNull();
  });

  it("a dry-run reveals the counts and unlocks the real sweep", async () => {
    const user = userEvent.setup();
    render(<GcView />);
    await user.click(screen.getByRole("button", { name: /dry-run/i }));
    expect(await screen.findByText(/orphan\(s\) would be deleted/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /run real sweep/i })).toBeTruthy();
  });

  it("a confirmed real sweep reports the deleted count", async () => {
    const user = userEvent.setup();
    render(<GcView />);
    await user.click(screen.getByRole("button", { name: /dry-run/i }));
    await user.click(await screen.findByRole("button", { name: /run real sweep/i }));
    await user.click(await screen.findByRole("button", { name: /confirm delete/i }));
    expect(await screen.findByText(/orphan blob\(s\) deleted/i)).toBeTruthy();
  });
});

describe("PostAdminView — confirm safety", () => {
  it("disables the actions until an id is entered", async () => {
    const user = userEvent.setup();
    render(<PostAdminView />);
    const del = screen.getByRole("button", { name: /soft-delete/i });
    expect((del as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText(/post id/i), "post-enable");
    expect((del as HTMLButtonElement).disabled).toBe(false);
  });

  it("editing the id clears an open confirm (can't confirm against a changed id)", async () => {
    const user = userEvent.setup();
    render(<PostAdminView />);
    await user.type(screen.getByLabelText(/post id/i), "post-clear");
    await user.click(screen.getByRole("button", { name: /purge…/i }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await user.type(screen.getByLabelText(/post id/i), "X"); // edit mid-confirm
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("purging a non-deleted post reports a no-op, not an error", async () => {
    const user = userEvent.setup();
    render(<PostAdminView />);
    await user.type(screen.getByLabelText(/post id/i), "post-noop");
    await user.click(screen.getByRole("button", { name: /purge…/i }));
    await user.click(screen.getByRole("button", { name: /confirm purge/i }));
    expect(await screen.findByText(/nothing purged/i)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull(); // a no-op is a result, not an error
  });
});
