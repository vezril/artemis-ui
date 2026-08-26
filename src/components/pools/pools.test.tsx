// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PoolsView } from "./pools-view";
import { PoolView } from "./pool-view";
import { AddToPool } from "./add-to-pool";
import { slugify } from "./new-pool-dialog";
import { ApiError, type PoolDetail, type PoolListPage, type PostPage } from "@/lib/api/types";

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

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// A controllable stub client: a mutable pool store the components mutate through
// the same methods the live client exposes, plus spies for call-shape assertions.
const api = vi.hoisted(() => {
  const state = {
    pools: [] as { id: string; name: string; posts: string[] }[],
    failNext: null as string | null, // method name whose next call should reject
  };
  function maybeFail(method: string) {
    if (state.failNext === method) {
      state.failNext = null;
      throw new ApiError(`${method} failed`, 500);
    }
  }
  return {
    state,
    listPools: vi.fn(async (): Promise<PoolListPage> => {
      maybeFail("listPools");
      return {
        pools: state.pools.map((p) => ({
          id: p.id,
          name: p.name,
          postCount: p.posts.length,
          cover: null,
        })),
        nextCursor: null,
      };
    }),
    getPool: vi.fn(async (id: string): Promise<PoolDetail> => {
      const p = state.pools.find((x) => x.id === id);
      if (!p) throw new ApiError("pool not found", 404);
      return { id: p.id, name: p.name, posts: [...p.posts] };
    }),
    poolPosts: vi.fn(async (): Promise<PostPage> => ({ posts: [], nextCursor: null })),
    createPool: vi.fn(async (id: string, name: string) => {
      maybeFail("createPool");
      if (state.pools.some((x) => x.id === id)) throw new ApiError("pool already exists", 409);
      state.pools.push({ id, name, posts: [] });
    }),
    renamePool: vi.fn(async (id: string, name: string) => {
      maybeFail("renamePool");
      const p = state.pools.find((x) => x.id === id);
      if (p) p.name = name;
    }),
    deletePool: vi.fn(async (id: string) => {
      maybeFail("deletePool");
      state.pools = state.pools.filter((x) => x.id !== id);
    }),
    addPoolPost: vi.fn(async (id: string, postId: string) => {
      maybeFail("addPoolPost");
      const p = state.pools.find((x) => x.id === id);
      if (p && !p.posts.includes(postId)) p.posts.push(postId);
    }),
    removePoolPost: vi.fn(async (id: string, postId: string) => {
      maybeFail("removePoolPost");
      const p = state.pools.find((x) => x.id === id);
      if (p) p.posts = p.posts.filter((x) => x !== postId);
    }),
    reorderPool: vi.fn(async (id: string, order: string[]) => {
      maybeFail("reorderPool");
      const p = state.pools.find((x) => x.id === id);
      if (p) p.posts = [...order];
    }),
  };
});

vi.mock("@/lib/api", () => ({
  getClient: () => ({
    live: false,
    baseUrl: null,
    listPools: api.listPools,
    getPool: api.getPool,
    poolPosts: api.poolPosts,
    createPool: api.createPool,
    renamePool: api.renamePool,
    deletePool: api.deletePool,
    addPoolPost: api.addPoolPost,
    removePoolPost: api.removePoolPost,
    reorderPool: api.reorderPool,
  }),
}));

beforeEach(() => {
  api.state.pools = [
    { id: "series-a", name: "Series A", posts: ["p1", "p2", "p3"] },
    { id: "empty", name: "Zed empty", posts: [] },
  ];
  api.state.failNext = null;
  router.push.mockReset();
  for (const fn of [
    api.listPools,
    api.getPool,
    api.poolPosts,
    api.createPool,
    api.renamePool,
    api.deletePool,
    api.addPoolPost,
    api.removePoolPost,
    api.reorderPool,
  ]) {
    fn.mockClear();
  }
});
afterEach(cleanup);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("slugify", () => {
  it("kebab-cases names and strips invalid characters", () => {
    expect(slugify("My Summer Pool!")).toBe("my-summer-pool");
    expect(slugify("  a  b  ")).toBe("a-b");
    expect(slugify("---")).toBe("");
  });
});

describe("PoolsView", () => {
  it("renders pool cards with names and counts", async () => {
    wrap(<PoolsView />);
    // The card name AND its placeholder both carry the text — assert on the card link.
    expect((await screen.findAllByText("Series A")).length).toBeGreaterThan(0);
    expect(screen.getByText("3 posts")).toBeTruthy();
    expect(screen.getByText("0 posts")).toBeTruthy();
  });

  it("creates a pool from the dialog with a derived slug id", async () => {
    const user = userEvent.setup();
    wrap(<PoolsView />);
    await screen.findAllByText("Series A");

    await user.click(screen.getByRole("button", { name: /new pool/i }));
    await user.type(screen.getByLabelText("Name"), "Beach Trip");
    await user.click(screen.getByRole("button", { name: /create pool/i }));

    await waitFor(() => expect(api.createPool).toHaveBeenCalledWith("beach-trip", "Beach Trip"));
    // The list refreshes to include the new pool.
    expect((await screen.findAllByText("Beach Trip")).length).toBeGreaterThan(0);
  });

  it("surfaces a duplicate-id 409 inline and keeps the dialog open", async () => {
    const user = userEvent.setup();
    wrap(<PoolsView />);
    await screen.findAllByText("Series A");

    await user.click(screen.getByRole("button", { name: /new pool/i }));
    await user.type(screen.getByLabelText("Name"), "Series A");
    // Slug "series-a" collides with the existing pool.
    await user.click(screen.getByRole("button", { name: /create pool/i }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/already exists/i)).toBeTruthy();
    // The dialog stayed open (its name field is still there).
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });
});

describe("PoolView", () => {
  it("renders members in the entity's order with position labels", async () => {
    wrap(<PoolView id="series-a" />);
    await screen.findByRole("heading", { name: /series a/i });
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("1")).toBeTruthy();
    expect(within(items[0]).getByRole("link")).toBeTruthy(); // browse mode links
    expect(items).toHaveLength(3);
  });

  it("keyboard move sends the FULL permutation and reorders optimistically", async () => {
    const user = userEvent.setup();
    wrap(<PoolView id="series-a" />);
    await screen.findByRole("heading", { name: /series a/i });

    await user.click(screen.getByRole("button", { name: /^arrange$/i }));
    // Move p2 (index 1) earlier → [p2, p1, p3].
    await user.click(screen.getByRole("button", { name: /move post p2 earlier/i }));

    await waitFor(() =>
      expect(api.reorderPool).toHaveBeenCalledWith("series-a", ["p2", "p1", "p3"]),
    );
  });

  it("a failed reorder rolls back and shows an attributed, dismissible error", async () => {
    const user = userEvent.setup();
    api.state.failNext = "reorderPool";
    wrap(<PoolView id="series-a" />);
    await screen.findByRole("heading", { name: /series a/i });

    await user.click(screen.getByRole("button", { name: /^arrange$/i }));
    await user.click(screen.getByRole("button", { name: /move post p2 earlier/i }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/reorderPool failed/i)).toBeTruthy();
    // Rolled back: p1 is first again (its tile shows position 1 and the p1 move-earlier
    // button is the disabled one).
    await waitFor(() => {
      const earlier = screen.getByRole("button", { name: /move post p1 earlier/i });
      expect(earlier.hasAttribute("disabled")).toBe(true);
    });
  });

  it("removes a member in arrange mode", async () => {
    const user = userEvent.setup();
    wrap(<PoolView id="series-a" />);
    await screen.findByRole("heading", { name: /series a/i });

    await user.click(screen.getByRole("button", { name: /^arrange$/i }));
    await user.click(screen.getByRole("button", { name: /remove post p2/i }));

    await waitFor(() => expect(api.removePoolPost).toHaveBeenCalledWith("series-a", "p2"));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
  });

  it("renames inline", async () => {
    const user = userEvent.setup();
    wrap(<PoolView id="series-a" />);
    await screen.findByRole("heading", { name: /series a/i });

    await user.click(screen.getByRole("button", { name: /rename pool/i }));
    const input = screen.getByRole("textbox", { name: /pool name/i });
    await user.clear(input);
    await user.type(input, "Renamed Set{Enter}");

    await waitFor(() => expect(api.renamePool).toHaveBeenCalledWith("series-a", "Renamed Set"));
    expect(await screen.findByRole("heading", { name: /renamed set/i })).toBeTruthy();
  });

  it("deletes behind a confirm and navigates back to the index", async () => {
    const user = userEvent.setup();
    wrap(<PoolView id="series-a" />);
    await screen.findByRole("heading", { name: /series a/i });

    await user.click(screen.getByRole("button", { name: /delete pool/i }));
    expect(api.deletePool).not.toHaveBeenCalled(); // confirm gate
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(api.deletePool).toHaveBeenCalledWith("series-a"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/pools"));
  });

  it("shows the designed not-found state for an unknown pool", async () => {
    wrap(<PoolView id="nope" />);
    expect(await screen.findByText(/pool not found/i)).toBeTruthy();
  });

  it("adds a member by id (validated non-empty)", async () => {
    const user = userEvent.setup();
    wrap(<PoolView id="series-a" />);
    await screen.findByRole("heading", { name: /series a/i });

    const field = screen.getByRole("textbox", { name: /post id to add/i });
    // Empty input: the Add button is disabled, no request fires.
    expect(screen.getByRole("button", { name: /^add$/i }).hasAttribute("disabled")).toBe(true);
    await user.type(field, "p9");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => expect(api.addPoolPost).toHaveBeenCalledWith("series-a", "p9"));
  });
});

describe("AddToPool (post view action)", () => {
  it("lists pools and appends the post to the chosen one", async () => {
    const user = userEvent.setup();
    wrap(<AddToPool postId="pX" />);

    await user.click(screen.getByRole("button", { name: /add to pool/i }));
    await user.click(await screen.findByRole("menuitem", { name: /series a/i }));

    await waitFor(() => expect(api.addPoolPost).toHaveBeenCalledWith("series-a", "pX"));
    expect(await screen.findByText(/added/i)).toBeTruthy();
  });

  it("resets the Added confirmation when remounted for a different post (the key contract)", async () => {
    // post-view keys <AddToPool key={post.id}> so navigation remounts it; simulate that.
    const user = userEvent.setup();
    const { rerender } = wrap(<AddToPool key="pX" postId="pX" />);

    await user.click(screen.getByRole("button", { name: /add to pool/i }));
    await user.click(await screen.findByRole("menuitem", { name: /series a/i }));
    expect(await screen.findByText(/added/i)).toBeTruthy();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AddToPool key="pY" postId="pY" />
      </QueryClientProvider>,
    );
    // Fresh mount → no lingering "Added" from the previous post.
    expect(screen.queryByText(/added/i)).toBeNull();
  });
});
