import { describe, it, expect } from "vitest";

import { formatTimestamp } from "../../lib/formatTimestamp";

describe("formatTimestamp", () => {
  it("includes the year", () => {
    expect(formatTimestamp("2024-03-15T14:30:00.000Z")).toContain("2024");
  });

  it("includes hours and zero-padded minutes", () => {
    expect(formatTimestamp("2024-03-15T14:30:00.000Z")).toMatch(/\d{1,2}:\d{2}/);
  });

  it("includes a timezone abbreviation", () => {
    // e.g. UTC, GMT, EST, EDT, AEST — at least two consecutive uppercase letters
    expect(formatTimestamp("2024-03-15T14:30:00.000Z")).toMatch(/[A-Z]{2,}/);
  });

  it("produces different output for different dates", () => {
    const t1 = formatTimestamp("2023-01-01T00:00:00.000Z");
    const t2 = formatTimestamp("2024-12-31T23:59:00.000Z");
    expect(t1).not.toEqual(t2);
  });
});
