import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureClient } from "./fixtures";
import { httpClient } from "./http";

/**
 * Saved-searches contract tests. The live contract (entity-backed, read-your-
 * writes): `GET /saved-searches` → `{searches:[{name, query}]}`; `POST` saves
 * `{name, query}`; `PATCH /saved-searches/{name}` renames with `{name: to}`;
 * `DELETE /saved-searches/{name}` removes. Names travel in path segments, so
 * they MUST be URL-encoded (names may contain spaces).
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

describe("httpClient saved searches", () => {
  it("listSavedSearches unwraps {searches} and drops malformed rows", async () => {
    const calls = mockFetch({
      searches: [
        { name: "Cat girls", query: "1girl cat_ears" },
        { name: 42, query: "broken" }, // malformed → dropped, not thrown
        { name: "Night", query: "night" },
      ],
    });
    const list = await httpClient("http://x").listSavedSearches();
    expect(calls[0].url).toBe("http://x/saved-searches");
    expect(list).toEqual([
      { name: "Cat girls", query: "1girl cat_ears" },
      { name: "Night", query: "night" },
    ]);
  });

  it("writes hit the right endpoints, URL-encoding names with spaces", async () => {
    const calls = mockFetch({});
    const c = httpClient("http://x");

    await c.saveSearch("My cats", "1girl cat_ears");
    expect(calls[0].url).toBe("http://x/saved-searches");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      name: "My cats",
      query: "1girl cat_ears",
    });

    await c.renameSavedSearch("My cats", "Our cats");
    expect(calls[1].url).toBe("http://x/saved-searches/My%20cats");
    expect(calls[1].init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ name: "Our cats" });

    await c.deleteSavedSearch("Our cats");
    expect(calls[2].url).toBe("http://x/saved-searches/Our%20cats");
    expect(calls[2].init?.method).toBe("DELETE");
  });

  it("passes server error messages through (duplicate name)", async () => {
    mockFetch({ error: "a search with this name already exists" }, 409);
    await expect(httpClient("http://x").saveSearch("dup", "q")).rejects.toMatchObject({
      status: 409,
      message: "a search with this name already exists",
    });
  });
});

describe("fixtureClient saved searches (parity)", () => {
  it("round-trips save/rename/delete with validation", async () => {
    const c = fixtureClient();

    const before = await c.listSavedSearches();
    expect(before.length).toBeGreaterThan(0);

    await c.saveSearch("Landscapes", "outdoors sky");
    expect((await c.listSavedSearches()).some((s) => s.name === "Landscapes")).toBe(true);

    // Duplicate → 409-style; invalid → 400-style.
    await expect(c.saveSearch("Landscapes", "x")).rejects.toMatchObject({ status: 409 });
    await expect(c.saveSearch("   ", "x")).rejects.toMatchObject({ status: 400 });

    await c.renameSavedSearch("Landscapes", "Wide shots");
    const renamed = await c.listSavedSearches();
    expect(renamed.some((s) => s.name === "Wide shots")).toBe(true);
    expect(renamed.some((s) => s.name === "Landscapes")).toBe(false);

    await c.deleteSavedSearch("Wide shots");
    expect((await c.listSavedSearches()).some((s) => s.name === "Wide shots")).toBe(false);
    await expect(c.deleteSavedSearch("Wide shots")).rejects.toMatchObject({ status: 404 });
  });
});
