import { describe, it, expect } from "vitest";

import {
  clientDestinationFor,
  clientNameFor,
  clientUrlFor,
  postClientOptions,
  postedAnswerLink,
} from "../../lib/waypointClients";
import { postWaypointTargetFor, profileWaypointTargetFor } from "../../lib/waypointTarget";

const target = postWaypointTargetFor(
  "at://did:plc:abc123/app.bsky.feed.post/3k7qw",
  "alice.bsky.social"
)!;

const profileTarget = profileWaypointTargetFor("alice.bsky.social", "did:plc:abc123")!;

describe("postClientOptions", () => {
  it("offers Bluesky among the clients that can open a post", () => {
    expect(postClientOptions).toContainEqual({ value: "bluesky", label: "Bluesky" });
  });

  it("leaves out a client that renders another lexicon entirely", () => {
    const ids = postClientOptions.map((option) => option.value);
    // Tangled is a git forge (sh.tangled.), Leaflet a publication reader.
    expect(ids).not.toContain("tangled");
    expect(ids).not.toContain("leaflet");
    expect(ids).not.toContain("grain");
  });

  it("keeps the generic record browsers, which render any collection", () => {
    const ids = postClientOptions.map((option) => option.value);
    expect(ids).toContain("pdsls");
    expect(ids).toContain("atptools");
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

  it("returns null for a client that cannot render a Bluesky post", () => {
    expect(clientUrlFor(target, "tangled")).toBeNull();
  });
});

const POSTED_LINK = "https://bsky.app/profile/alice.bsky.social/post/3k7qw";
const POST_URI = "at://did:plc:abc123/app.bsky.feed.post/3k7qw";

describe("postedAnswerLink", () => {
  it("opens the answer in the chosen client", () => {
    expect(postedAnswerLink(POST_URI, POSTED_LINK, "alice.bsky.social", "deer")).toBe(
      "https://deer.social/profile/alice.bsky.social/post/3k7qw"
    );
  });

  it("keeps the link the server posted when no client is chosen", () => {
    expect(postedAnswerLink(POST_URI, POSTED_LINK, "alice.bsky.social", null)).toBe(POSTED_LINK);
  });

  it("keeps the link the server posted for a client that cannot render a post", () => {
    expect(postedAnswerLink(POST_URI, POSTED_LINK, "alice.bsky.social", "tangled")).toBe(
      POSTED_LINK
    );
  });

  it("has nothing to offer for an answer that never became a post", () => {
    expect(postedAnswerLink(undefined, undefined, "alice.bsky.social", "deer")).toBeUndefined();
  });
});

describe("clientDestinationFor", () => {
  it("names and links the chosen client", () => {
    expect(clientDestinationFor(profileTarget, "deer")).toEqual({
      name: "Deer",
      url: "https://deer.social/profile/alice.bsky.social",
    });
  });

  it("falls back to Bluesky when no client is chosen", () => {
    expect(clientDestinationFor(profileTarget, null)).toEqual({
      name: "Bluesky",
      url: "https://bsky.app/profile/alice.bsky.social",
    });
  });

  it("falls back to Bluesky for a stored id that outlived its catalog entry", () => {
    expect(clientDestinationFor(profileTarget, "a-client-that-shut-down")?.name).toBe("Bluesky");
  });

  it("falls back to Bluesky for a client that cannot render this record", () => {
    const withoutDid = profileWaypointTargetFor("alice.bsky.social", undefined)!;
    expect(clientDestinationFor(withoutDid, "pdsls")?.name).toBe("Bluesky");
  });

  it("returns null when there is no target to open", () => {
    expect(clientDestinationFor(null, "deer")).toBeNull();
  });
});
