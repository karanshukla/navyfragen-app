import { describe, it, expect } from "vitest";

import { resolveApiErrorMessage } from "../../lib/i18n/apiErrors";
import { en } from "../../lib/i18n/en";

describe("resolveApiErrorMessage", () => {
  it("rung 1: renders the catalog string for a recognized ErrorCode", () => {
    expect(
      resolveApiErrorMessage(
        { error: "MESSAGES_FETCH_FAILED", message: "Failed to fetch messages" },
        en
      )
    ).toBe(en.errors.codes.MESSAGES_FETCH_FAILED);
  });

  it("rung 1 wins even when message is also present", () => {
    const result = resolveApiErrorMessage(
      { error: "NOT_AUTHENTICATED", message: "Not authenticated" },
      en
    );
    expect(result).toBe(en.errors.codes.NOT_AUTHENTICATED);
    expect(result).not.toBe("Not authenticated");
  });

  it("rung 2: falls back to the server's message when error isn't a known code", () => {
    expect(resolveApiErrorMessage({ error: "Some prose", message: "Network hiccup" }, en)).toBe(
      "Network hiccup"
    );
  });

  it("rung 2: falls back to message when error is absent entirely", () => {
    expect(resolveApiErrorMessage({ message: "Network hiccup" }, en)).toBe("Network hiccup");
  });

  it("rung 3: falls back to the generic string when neither error nor message is usable", () => {
    expect(resolveApiErrorMessage({}, en)).toBe(en.errors.generic);
  });

  it("rung 3: falls back to generic when error is an unrecognized code and message is empty", () => {
    expect(resolveApiErrorMessage({ error: "Some prose", message: "" }, en)).toBe(
      en.errors.generic
    );
  });

  it("rung 3: falls back to generic for null", () => {
    expect(resolveApiErrorMessage(null, en)).toBe(en.errors.generic);
  });

  it("rung 3: falls back to generic for undefined", () => {
    expect(resolveApiErrorMessage(undefined, en)).toBe(en.errors.generic);
  });
});
