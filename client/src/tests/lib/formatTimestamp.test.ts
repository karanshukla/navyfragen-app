import { describe, it, expect } from "vitest";

import { formatTimestamp } from "../../lib/formatTimestamp";

describe("formatTimestamp", () => {
  it("includes the year", () => {
    expect(formatTimestamp("2024-03-15T14:30:00.000Z", "en-US")).toContain("2024");
  });

  it("includes hours and zero-padded minutes", () => {
    expect(formatTimestamp("2024-03-15T14:30:00.000Z", "en-US")).toMatch(/\d{1,2}:\d{2}/);
  });

  it("includes a timezone abbreviation", () => {
    // e.g. UTC, GMT, EST, EDT, AEST — at least two consecutive uppercase letters
    expect(formatTimestamp("2024-03-15T14:30:00.000Z", "en-US")).toMatch(/[A-Z]{2,}/);
  });

  it("produces different output for different dates", () => {
    const t1 = formatTimestamp("2023-01-01T00:00:00.000Z", "en-US");
    const t2 = formatTimestamp("2024-12-31T23:59:00.000Z", "en-US");
    expect(t1).not.toEqual(t2);
  });

  it("formats in the requested non-English locale, not just the runtime default", () => {
    // German orders day-before-month with a trailing period and spells the
    // month natively ("März", not "Mar") — a genuinely different shape from
    // the en-US case above, not just a different string.
    const result = formatTimestamp("2024-03-15T14:30:00.000Z", "de-DE");
    expect(result).toMatch(/^\d{1,2}\.\s?März/);
  });
});
