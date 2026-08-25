import { describe, expect, it } from "vitest";

import { fixtureClient } from "./fixtures";
import { ApiError } from "./types";

// Each fixtureClient() is a fresh in-memory store, so these cases are isolated.

describe("fixture write methods mutate the in-memory post", () => {
  it("patchTags replaces the whole set", async () => {
    const c = fixtureClient();
    await c.patchTags("01J8A0", ["alpha", "beta"]);
    expect((await c.getPost("01J8A0")).tags).toEqual(["alpha", "beta"]);
  });

  it("setFavorite toggles by boolean", async () => {
    const c = fixtureClient();
    expect((await c.getPost("01J8A1")).favorited).toBe(false);
    await c.setFavorite("01J8A1", true);
    expect((await c.getPost("01J8A1")).favorited).toBe(true);
    await c.setFavorite("01J8A1", false);
    expect((await c.getPost("01J8A1")).favorited).toBe(false);
  });

  it("scorePost applies a delta (not an absolute set)", async () => {
    const c = fixtureClient();
    const base = (await c.getPost("01J8A2")).score;
    await c.scorePost("01J8A2", 5);
    await c.scorePost("01J8A2", -2);
    expect((await c.getPost("01J8A2")).score).toBe(base + 3);
  });

  it("setRating sets the rating", async () => {
    const c = fixtureClient();
    await c.setRating("01J8A3", "e");
    expect((await c.getPost("01J8A3")).rating).toBe("e");
  });

  it("a write to an unknown post 404s like the live service", async () => {
    const c = fixtureClient();
    await expect(c.patchTags("does-not-exist", [])).rejects.toBeInstanceOf(ApiError);
  });
});
