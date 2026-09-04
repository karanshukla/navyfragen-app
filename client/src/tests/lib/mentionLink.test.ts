import { describe, it, expect } from "vitest";

import { mentionLinkFor } from "../../lib/mentionLink";

describe("mentionLinkFor", () => {
  it("keeps a mention in this app when the reader asked it to", () => {
    expect(mentionLinkFor("deer", true)("alice.bsky.social")).toEqual({
      href: "/profile/alice.bsky.social",
      internal: true,
    });
  });

  it("follows a mention out to the reader's client when they did not", () => {
    expect(mentionLinkFor("deer", false)("alice.bsky.social")).toEqual({
      href: "https://deer.social/profile/alice.bsky.social",
      internal: false,
    });
  });

  it("leaves to Bluesky when the reader picked no client", () => {
    expect(mentionLinkFor(null, false)("alice.bsky.social").href).toBe(
      "https://bsky.app/profile/alice.bsky.social"
    );
  });

  it("leaves to Bluesky for a client that addresses a repo only by DID, which a bio has none of", () => {
    expect(mentionLinkFor("pdsls", false)("alice.bsky.social").href).toBe(
      "https://bsky.app/profile/alice.bsky.social"
    );
  });

  it("stays in this app when there is no handle to build a client link from", () => {
    expect(mentionLinkFor("deer", false)("")).toEqual({ href: "/profile/", internal: true });
  });
});
