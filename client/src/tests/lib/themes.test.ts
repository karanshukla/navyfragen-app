import { describe, it, expect } from "vitest";
import { themes } from "../../lib/themes";

describe("themes", () => {
  it("has all three theme keys", () => {
    expect(themes).toHaveProperty("default");
    expect(themes).toHaveProperty("compressed");
    expect(themes).toHaveProperty("twitter");
  });

  it("maps theme keys to display strings", () => {
    expect(themes.default).toBe("Default");
    expect(themes.compressed).toBe("Compressed");
    expect(themes.twitter).toBe("Twitter Style");
  });
});
