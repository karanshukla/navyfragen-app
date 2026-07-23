import { describe, it, expect } from "vitest";

import { themes, profileCardThemes, profileCardGradient } from "../../lib/themes";

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

describe("profileCardThemes (#275)", () => {
  it("includes the curated preset set", () => {
    expect(Object.keys(profileCardThemes).sort()).toEqual(["aurora", "ember", "royal", "verdant"]);
  });

  it("each preset has a label and a gradient token (no raw hex)", () => {
    for (const theme of Object.values(profileCardThemes)) {
      expect(typeof theme.label).toBe("string");
      expect(theme.label.length).toBeGreaterThan(0);
      // Gradients reference --nf-grad-* tokens, never inline colours.
      expect(theme.gradient).toMatch(/^var\(--nf-grad-/);
    }
  });

  it("royal reuses the default --nf-grad-mark gradient", () => {
    expect(profileCardThemes.royal.gradient).toBe("var(--nf-grad-mark)");
  });
});

describe("profileCardGradient", () => {
  it("resolves a known theme key to its gradient", () => {
    expect(profileCardGradient("ember")).toBe("var(--nf-grad-ember)");
    expect(profileCardGradient("aurora")).toBe("var(--nf-grad-aurora)");
  });

  it("falls back to the default gradient when unset (null)", () => {
    expect(profileCardGradient(null)).toBe("var(--nf-grad-mark)");
  });

  it("falls back to the default gradient for an unknown theme key", () => {
    expect(profileCardGradient("nonexistent")).toBe("var(--nf-grad-mark)");
  });

  it("falls back to the default gradient when undefined", () => {
    expect(profileCardGradient(undefined)).toBe("var(--nf-grad-mark)");
  });
});
