import { describe, it, expect } from "vitest";

import { clientNameFor, clientUrlFor, postClientOptions } from "../../lib/waypointClients";
import { waypointTargetFor } from "../../lib/waypointTarget";

const target = waypointTargetFor(
  "at://did:plc:abc123/app.bsky.feed.post/3k7qw",
  "alice.bsky.social"
)!;

describe("postClientOptions", () => {
  it("offers Bluesky among the clients that can open a post", () => {
    expect(postClientOptions).toContainEqual({ value: "bluesky", label: "Bluesky" });
  });

  it("is sorted by name rather than by the catalog's recommendation order", () => {
    const labels = postClientOptions.map((option) => option.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});

describe("clientNameFor", () => {
  it("names a client the catalog knows", () => {
    expect(clientNameFor("bluesky")).toBe("Bluesky");
  });

  it("returns null for an id the catalog has dropped", () => {
    expect(clientNameFor("a-client-that-shut-down")).toBeNull();
  });

  it("returns null when no client is chosen", () => {
    expect(clientNameFor(null)).toBeNull();
  });
});

describe("clientUrlFor", () => {
  it("builds the chosen client's url for the post", () => {
    expect(clientUrlFor(target, "bluesky")).toBe(
      "https://bsky.app/profile/alice.bsky.social/post/3k7qw"
    );
  });

  it("uses that client's own url shape, not Bluesky's", () => {
    expect(clientUrlFor(target, "deer")).toBe(
      "https://deer.social/profile/alice.bsky.social/post/3k7qw"
    );
  });

  it("returns null when no client is chosen", () => {
    expect(clientUrlFor(target, null)).toBeNull();
  });

  it("returns null for a stored id that outlived its catalog entry", () => {
    expect(clientUrlFor(target, "a-client-that-shut-down")).toBeNull();
  });
});
