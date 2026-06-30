import { describe, it, expect, beforeEach, vi } from "vitest";

import { buildAccountSwitchUrl, consumeAccountSwitchToast } from "../../lib/accountSwitchToast";

describe("accountSwitchToast", () => {
  beforeEach(() => {
    // Reset to a clean origin between tests so leftover params don't leak.
    window.history.replaceState({}, "", "/");
  });

  describe("buildAccountSwitchUrl", () => {
    it("appends the accountSwitched param with the given handle", () => {
      const result = buildAccountSwitchUrl("alice.bsky.social");
      expect(result).toBe("/?accountSwitched=alice.bsky.social");
    });

    it("preserves the existing path and query params", () => {
      window.history.replaceState({}, "", "/messages?thread=123");
      const result = buildAccountSwitchUrl("bob.bsky.social");
      expect(result).toBe("/messages?thread=123&accountSwitched=bob.bsky.social");
    });
  });

  describe("consumeAccountSwitchToast", () => {
    it("fires the toast and strips the param when the marker is present", () => {
      window.history.replaceState({}, "", "/?accountSwitched=karan.bsky.social");
      const showToast = vi.fn();

      consumeAccountSwitchToast(showToast);

      expect(showToast).toHaveBeenCalledOnce();
      expect(showToast).toHaveBeenCalledWith("Switched to @karan.bsky.social");
      expect(window.location.search).toBe("");
    });

    it("is a no-op when the marker is absent", () => {
      window.history.replaceState({}, "", "/messages");
      const showToast = vi.fn();

      consumeAccountSwitchToast(showToast);

      expect(showToast).not.toHaveBeenCalled();
    });
  });
});
