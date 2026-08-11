import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { isSectionOpen, setSectionOpen } from "../../lib/navSectionStorage";

const DID = "did:plc:example";

describe("navSectionStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports a section the user has never touched as open", () => {
    expect(isSectionOpen("Moots", DID)).toBe(true);
  });

  it("round-trips a collapsed section", () => {
    setSectionOpen("Moots", false, DID);
    expect(isSectionOpen("Moots", DID)).toBe(false);
  });

  it("round-trips a re-expanded section", () => {
    setSectionOpen("Moots", false, DID);
    setSectionOpen("Moots", true, DID);
    expect(isSectionOpen("Moots", DID)).toBe(true);
  });

  it("keeps sections independent of each other", () => {
    setSectionOpen("Moots", false, DID);
    expect(isSectionOpen("Oomfs", DID)).toBe(true);
  });

  it("keeps accounts independent of each other", () => {
    setSectionOpen("Moots", false, DID);
    expect(isSectionOpen("Moots", "did:plc:someone-else")).toBe(true);
  });

  it("falls back to open when the stored value is unparseable", () => {
    localStorage.setItem(`navyfragen_friends_sections_open_${DID}`, "{not json");
    expect(isSectionOpen("Moots", DID)).toBe(true);
  });

  it("falls back to open when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(isSectionOpen("Moots", DID)).toBe(true);
  });

  it("swallows a write failure rather than taking the sidebar down", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => setSectionOpen("Moots", false, DID)).not.toThrow();
  });
});
