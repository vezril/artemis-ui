import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureClient } from "./fixtures";
import { httpClient } from "./http";
import { ApiError } from "./types";

/**
 * Pools contract tests. The live contract (Artemis v1.2.0): projection-backed
 * `GET /pools` (`{pools:[{id,name,postCount,cover}], nextCursor}`) and
 * `GET /pools/{id}/posts` (`{posts:[PostSummary], nextCursor}`, never 404s);
 * entity `GET /pools/{id}` (`{id,name,posts:[postId]}`, 404s); writes as
 * 200-no-body entity commands (`PUT …/order` takes the FULL permutation).
 * These pin the request shapes, envelope unwrapping, and fixture-mode parity.
 */

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function mockFetch(body: unknown, status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return okJson(body, status);
  });
  vi.stubGlobal("fetch", spy);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const cover = {
  id: "p1",
  status: "active",
  tags: ["1girl"],
  rating: "s",
  score: 1,
  favCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  md5: "abc",
  derivatives: [{ kind: "thumbnail", variant: "thumb.webp" }],
};

describe("httpClient pools", () => {
  it("listPools unwraps pools + covers and normalizes the cursor", async () => {
    const calls = mockFetch({
      pools: [
        { id: "a", name: "Alpha", postCount: 2, cover },
        { id: "b", name: "Bravo", postCount: 0, cover: null },
      ],
      nextCursor: "",
    });
    const page = await httpClient("http://x").listPools();

    expect(calls[0].url).toBe("http://x/pools");
    expect(page.pools).toHaveLength(2);
    expect(page.pools[0].cover?.md5).toBe("abc");
    expect(page.pools[1].cover).toBeNull();
    // An empty-string cursor must terminate, not loop.
    expect(page.nextCursor).toBeNull();
  });

  it("listPools passes the cursor through", async () => {
    const calls = mockFetch({ pools: [], nextCursor: null });
    await httpClient("http://x").listPools("abc123");
    expect(new URL(calls[0].url).searchParams.get("cursor")).toBe("abc123");
  });

  it("getPool reads the entity shape and 404s as ApiError", async () => {
    const calls = mockFetch({ id: "a", name: "Alpha", posts: ["p2", "p1"] });
    const pool = await httpClient("http://x").getPool("a");
    expect(calls[0].url).toBe("http://x/pools/a");
    expect(pool.posts).toEqual(["p2", "p1"]);

    mockFetch({ error: "pool not found" }, 404);
    await expect(httpClient("http://x").getPool("nope")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("poolPosts unwraps the shared posts envelope", async () => {
    const calls = mockFetch({ posts: [cover], nextCursor: "n1" });
    const page = await httpClient("http://x").poolPosts("a");
    expect(calls[0].url).toBe("http://x/pools/a/posts");
    expect(page.posts[0].id).toBe("p1");
    expect(page.nextCursor).toBe("n1");
  });

  it("writes hit the right endpoints with the right bodies", async () => {
    const calls = mockFetch({});
    const c = httpClient("http://x");

    await c.createPool("my-pool", "My pool");
    expect(calls[0].url).toBe("http://x/pools");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ id: "my-pool", name: "My pool" });

    await c.renamePool("my-pool", "Renamed");
    expect(calls[1].init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ name: "Renamed" });

    await c.addPoolPost("my-pool", "p9");
    expect(calls[2].url).toBe("http://x/pools/my-pool/posts");
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({ postId: "p9" });

    await c.removePoolPost("my-pool", "p9");
    expect(calls[3].url).toBe("http://x/pools/my-pool/posts/p9");
    expect(calls[3].init?.method).toBe("DELETE");

    await c.reorderPool("my-pool", ["p2", "p1"]);
    expect(calls[4].url).toBe("http://x/pools/my-pool/order");
    expect(calls[4].init?.method).toBe("PUT");
    // The body is the FULL permutation, never a partial move.
    expect(JSON.parse(String(calls[4].init?.body))).toEqual({ order: ["p2", "p1"] });

    await c.deletePool("my-pool");
    expect(calls[5].init?.method).toBe("DELETE");
    expect(calls[5].url).toBe("http://x/pools/my-pool");
  });

  it("createPool surfaces a 409 with the server's message", async () => {
    mockFetch({ error: "pool already exists" }, 409);
    await expect(httpClient("http://x").createPool("dup", "Dup")).rejects.toMatchObject({
      status: 409,
      message: "pool already exists",
    });
  });
});

describe("fixtureClient pools (parity)", () => {
  it("lists seeded pools with covers, reads members in order, and round-trips writes", async () => {
    const c = fixtureClient();

    const page = await c.listPools();
    const sunset = page.pools.find((p) => p.id === "sunset-set");
    expect(sunset?.postCount).toBeGreaterThan(0);
    expect(sunset?.cover?.id).toBeTruthy();
    expect(page.pools.find((p) => p.id === "empty-pool")?.cover).toBeNull();

    const detail = await c.getPool("sunset-set");
    const members = await c.poolPosts("sunset-set");
    // Hydrated members come back in the entity's order (active-only).
    expect(members.posts.map((p) => p.id)).toEqual(
      detail.posts.filter((id) => members.posts.some((p) => p.id === id)),
    );

    // Reorder round-trip: reversed permutation applies; non-permutation rejects.
    const reversed = [...detail.posts].reverse();
    await c.reorderPool("sunset-set", reversed);
    expect((await c.getPool("sunset-set")).posts).toEqual(reversed);
    await expect(c.reorderPool("sunset-set", ["only-one"])).rejects.toBeInstanceOf(ApiError);

    // Idempotent add; create-dup 409; unknown pool members read is empty not 404.
    await c.addPoolPost("empty-pool", "01J8A3");
    await c.addPoolPost("empty-pool", "01J8A3");
    expect((await c.getPool("empty-pool")).posts).toEqual(["01J8A3"]);
    await expect(c.createPool("sunset-set", "X")).rejects.toMatchObject({ status: 409 });
    expect((await c.poolPosts("does-not-exist")).posts).toEqual([]);
    await expect(c.getPool("does-not-exist")).rejects.toMatchObject({ status: 404 });
  });
});
