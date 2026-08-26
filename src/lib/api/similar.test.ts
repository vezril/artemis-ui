import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureClient } from "./fixtures";
import { httpClient } from "./http";

/**
 * Tier-1 near-duplicate search. The live contract is
 * `GET /posts/{id}/similar?threshold=&limit=` and `GET /similar?phash=&…`,
 * both answering `{similar:[{id, distance}]}` closest-first. These cases pin the
 * request shape (paths, params, omission of unset tuning) and the unwrapping of
 * the `similar` envelope, plus fixture-mode parity.
 */

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** Stub `fetch`, capturing the requested URLs so assertions can index them directly. */
function mockFetch(body: unknown) {
  const calls: string[] = [];
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return okJson(body);
  });
  vi.stubGlobal("fetch", spy);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("httpClient similarity", () => {
  it("similarToPost calls /posts/{id}/similar and unwraps `similar`", async () => {
    const calls = mockFetch({
      similar: [
        { id: "b", distance: 2 },
        { id: "c", distance: 6 },
      ],
    });
    const matches = await httpClient("http://x").similarToPost("a");

    expect(matches).toEqual([
      { id: "b", distance: 2 },
      { id: "c", distance: 6 },
    ]);
    expect(calls[0]).toBe("http://x/posts/a/similar");
  });

  it("passes threshold and limit when given, and omits them when not", async () => {
    const calls = mockFetch({ similar: [] });
    const c = httpClient("http://x");

    await c.similarToPost("a", { threshold: 4, limit: 5 });
    const withParams = new URL(calls[0]);
    expect(withParams.searchParams.get("threshold")).toBe("4");
    expect(withParams.searchParams.get("limit")).toBe("5");

    await c.similarToPost("a");
    expect(new URL(calls[1]).search).toBe("");
  });

  it("similarToPhash calls /similar with the phash as a query param", async () => {
    const calls = mockFetch({ similar: [{ id: "z", distance: 0 }] });
    const matches = await httpClient("http://x").similarToPhash("ff00ff00ff00ff00");

    expect(matches).toEqual([{ id: "z", distance: 0 }]);
    const url = new URL(calls[0]);
    expect(url.pathname).toBe("/similar");
    expect(url.searchParams.get("phash")).toBe("ff00ff00ff00ff00");
  });

  it("tolerates a missing/!array `similar` envelope rather than throwing", async () => {
    mockFetch({});
    await expect(httpClient("http://x").similarToPost("a")).resolves.toEqual([]);
  });

  it("id is path-encoded so an odd id can't break out of the path", async () => {
    const calls = mockFetch({ similar: [] });
    await httpClient("http://x").similarToPost("a/b");
    expect(calls[0]).toBe("http://x/posts/a%2Fb/similar");
  });
});

describe("fixtureClient similarity", () => {
  it("returns matches closest-first and never includes the target itself", async () => {
    const c = fixtureClient();
    const { posts } = await c.searchPosts({ tags: "" });
    const target = posts[0].id;

    const matches = await c.similarToPost(target);
    expect(matches.some((m) => m.id === target)).toBe(false);
    expect([...matches].sort((a, b) => a.distance - b.distance)).toEqual(matches);
  });

  it("honours limit", async () => {
    const c = fixtureClient();
    const { posts } = await c.searchPosts({ tags: "" });
    expect((await c.similarToPost(posts[0].id, { limit: 1 })).length).toBeLessThanOrEqual(1);
  });

  it("only returns matches within the threshold", async () => {
    const c = fixtureClient();
    const { posts } = await c.searchPosts({ tags: "" });
    const matches = await c.similarToPost(posts[0].id, { threshold: 3 });
    expect(matches.every((m) => m.distance <= 3)).toBe(true);
  });
});
