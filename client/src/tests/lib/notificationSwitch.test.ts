import { describe, it, expect, beforeEach } from "vitest";

import { consumeNotificationSwitchRequest } from "../../lib/notificationSwitch";

describe("notificationSwitch", () => {
  beforeEach(() => {
    // Reset to a clean origin between tests so leftover params don't leak.
    window.history.replaceState({}, "", "/");
  });

  describe("consumeNotificationSwitchRequest", () => {
    it("returns null and leaves the URL untouched when notifyDid is absent", () => {
      window.history.replaceState({}, "", "/messages?thread=123");

      const result = consumeNotificationSwitchRequest();

      expect(result).toBeNull();
      expect(window.location.pathname + window.location.search).toBe("/messages?thread=123");
    });

    it("returns the did and handle, stripping both params", () => {
      window.history.replaceState(
        {},
        "",
        "/messages?notifyDid=did:plc:foo&notifyHandle=foo.bsky.social"
      );

      const result = consumeNotificationSwitchRequest();

      expect(result).toEqual({ did: "did:plc:foo", handle: "foo.bsky.social" });
      expect(window.location.search).toBe("");
    });

    it("returns did with an undefined handle when notifyHandle is absent", () => {
      window.history.replaceState({}, "", "/messages?notifyDid=did:plc:foo");

      const result = consumeNotificationSwitchRequest();

      expect(result).toEqual({ did: "did:plc:foo", handle: undefined });
    });

    it("preserves unrelated query params", () => {
      window.history.replaceState({}, "", "/messages?thread=123&notifyDid=did:plc:foo");

      consumeNotificationSwitchRequest();

      expect(window.location.pathname + window.location.search).toBe("/messages?thread=123");
    });
  });
});
