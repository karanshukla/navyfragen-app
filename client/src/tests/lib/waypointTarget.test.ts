import { describe, it, expect } from "vitest";

import { postWaypointTargetFor, profileWaypointTargetFor } from "../../lib/waypointTarget";

const POST_URI = "at://did:plc:abc123/app.bsky.feed.post/3k7qw";

describe("postWaypointTargetFor", () => {
  it("reads the type, did, collection and rkey out of a post's AT URI", () => {
    expect(postWaypointTargetFor(POST_URI, "alice.bsky.social")).toMatchObject({
      type: "post",
      did: "did:plc:abc123",
      collection: "app.bsky.feed.post",
      rkey: "3k7qw",
    });
  });

  it("addresses the author by handle when the session knows one", () => {
    expect(postWaypointTargetFor(POST_URI, "alice.bsky.social")?.handle).toBe("alice.bsky.social");
  });

  it("falls back to the DID the URI carries when it does not", () => {
    expect(postWaypointTargetFor(POST_URI, undefined)?.handle).toBe("did:plc:abc123");
  });

  it("returns null for a URI that names no record", () => {
    expect(postWaypointTargetFor("https://bsky.app/profile/alice", "alice.bsky.social")).toBeNull();
  });

  it("returns null when there is no URI at all", () => {
    expect(postWaypointTargetFor(undefined, "alice.bsky.social")).toBeNull();
  });
});

describe("profileWaypointTargetFor", () => {
  it("reads a bare handle as a profile target", () => {
    expect(profileWaypointTargetFor("alice.bsky.social", undefined)).toMatchObject({
      type: "profile",
      handle: "alice.bsky.social",
    });
  });

  it("carries the DID that the DID-only clients address a repo by", () => {
    expect(profileWaypointTargetFor("alice.bsky.social", "did:plc:abc123")?.did).toBe(
      "did:plc:abc123"
    );
  });

  it("returns null without a handle to address", () => {
    expect(profileWaypointTargetFor(undefined, "did:plc:abc123")).toBeNull();
  });
});
