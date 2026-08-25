import { describe, expect, it } from "vitest";

import { ApiError } from "./types";
import { FIXTURE_UPLOAD_POLLS_TO_ACTIVE, fixtureClient } from "./fixtures";

function pngFile(name = "photo.png"): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: "image/png" });
}

describe("fixture upload lifecycle", () => {
  it("returns {postId, status:'pending'} and getPost then finds the pending post", async () => {
    const client = fixtureClient();
    const { postId, status } = await client.upload(pngFile());

    expect(status).toBe("pending");
    expect(postId).toMatch(/^upload-/);

    const post = await client.getPost(postId);
    expect(post.id).toBe(postId);
    // First poll: still pending (threshold not yet reached).
    expect(post.status).toBe("pending");
  });

  it("transitions pending → active after the fixture poll threshold", async () => {
    const client = fixtureClient();
    const { postId } = await client.upload(pngFile());

    // Poll up to (but not past) the threshold — the flip happens on the Nth poll.
    let status = "pending";
    for (let i = 0; i < FIXTURE_UPLOAD_POLLS_TO_ACTIVE; i++) {
      status = (await client.getPost(postId)).status;
    }
    expect(status).toBe("active");

    // Once active it has derivatives and stays active on further polls.
    const post = await client.getPost(postId);
    expect(post.status).toBe("active");
    expect(post.derivatives.length).toBeGreaterThan(0);
  });

  it("rejects an empty file with a 400 ApiError", async () => {
    const client = fixtureClient();
    const empty = new File([], "empty.png", { type: "image/png" });
    await expect(client.upload(empty)).rejects.toBeInstanceOf(ApiError);
  });

  it("keeps each upload independent (distinct post ids)", async () => {
    const client = fixtureClient();
    const a = await client.upload(pngFile("a.png"));
    const b = await client.upload(pngFile("b.png"));
    expect(a.postId).not.toBe(b.postId);
  });
});
