import { describe, it, expect } from "vitest";

import { waypointTargetFor } from "../../lib/waypointTarget";

const POST_URI = "at://did:plc:abc123/app.bsky.feed.post/3k7qw";

describe("waypointTargetFor", () => {
  it("reads the type, did, collection and rkey out of a post's AT URI", () => {
    expect(waypointTargetFor(POST_URI, "alice.bsky.social")).toMatchObject({
      type: "post",
      did: "did:plc:abc123",
      collection: "app.bsky.feed.post",
      rkey: "3k7qw",
    });
  });

  it("addresses the author by handle when the session knows one", () => {
    expect(waypointTargetFor(POST_URI, "alice.bsky.social")?.handle).toBe("alice.bsky.social");
  });

  it("falls back to the DID the URI carries when it does not", () => {
    expect(waypointTargetFor(POST_URI, undefined)?.handle).toBe("did:plc:abc123");
  });

  it("returns null for a URI that names no record", () => {
    expect(waypointTargetFor("https://bsky.app/profile/alice", "alice.bsky.social")).toBeNull();
  });

  it("returns null when there is no URI at all", () => {
    expect(waypointTargetFor(undefined, "alice.bsky.social")).toBeNull();
  });
});
