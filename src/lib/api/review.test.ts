import { describe, expect, it } from "vitest";

import { fixtureClient } from "./fixtures";

// Each fixtureClient() is a fresh in-memory review backlog, so these cases are isolated.

describe("fixture review queue", () => {
  it("getReviewQueue returns the seeded backlog with varied suggestions", async () => {
    const c = fixtureClient();
    const queue = await c.getReviewQueue();

    expect(queue.length).toBe(3);
    expect(queue[0].postId).toBe("01J8A7");
    // Suggestions carry a tag, a confidence in [0,1], and a source.
    const first = queue[0].suggestions[0];
    expect(typeof first.tag).toBe("string");
    expect(first.confidence).toBeGreaterThan(0);
    expect(first.confidence).toBeLessThanOrEqual(1);
    expect(first.source).toBeTruthy();
    // A mix of sources across the backlog.
    const sources = new Set(queue.flatMap((i) => i.suggestions.map((s) => s.source)));
    expect(sources.has("wd-tagger")).toBe(true);
    expect(sources.has("ram++")).toBe(true);
  });

  it("getReviewQueue clamps the limit and returns copies", async () => {
    const c = fixtureClient();
    const one = await c.getReviewQueue(1);
    expect(one.length).toBe(1);

    // Mutating a returned item must not affect the backlog.
    const queue = await c.getReviewQueue();
    queue[0].suggestions.pop();
    const again = await c.getReviewQueue();
    expect(again[0].suggestions.length).toBeGreaterThan(0);
  });

  it("reviewPost with accepted tags removes the post and applies the tags", async () => {
    const c = fixtureClient();
    await c.reviewPost("01J8A7", ["cat_ears", "night"]);

    const queue = await c.getReviewQueue();
    expect(queue.length).toBe(2);
    expect(queue.some((i) => i.postId === "01J8A7")).toBe(false);

    // The accepted tags are now on the post (union with its existing tags).
    const post = await c.getPost("01J8A7");
    expect(post.tags).toContain("cat_ears");
    expect(post.tags).toContain("night");
  });

  it("reviewPost with an empty accept (reject-all) removes the post, applies nothing", async () => {
    const c = fixtureClient();
    const before = (await c.getPost("01J8A2")).tags.slice();
    await c.reviewPost("01J8A2", []);

    const queue = await c.getReviewQueue();
    expect(queue.some((i) => i.postId === "01J8A2")).toBe(false);

    // Reject-all left the post's tags untouched.
    const after = (await c.getPost("01J8A2")).tags;
    expect(after).toEqual(before);
  });
});
