import { describe, it, expect } from "vitest";

import { en } from "../../lib/i18n/en";
import {
  imageThemeIds,
  imageThemeLabels,
  profileCardThemes,
  profileCardGradient,
} from "../../lib/themes";

describe("imageThemeLabels", () => {
  it("has all three theme keys", () => {
    const themes = imageThemeLabels(en);
    expect(themes).toHaveProperty("default");
    expect(themes).toHaveProperty("compressed");
    expect(themes).toHaveProperty("twitter");
  });

  it("maps theme ids to the catalog's display strings", () => {
    const themes = imageThemeLabels(en);
    for (const id of imageThemeIds) {
      expect(themes[id]).toBe(en.themes.image[id]);
    }
  });
});

describe("profileCardThemes (#275)", () => {
  it("includes the curated preset set", () => {
    expect(Object.keys(profileCardThemes(en)).sort()).toEqual([
      "aurora",
      "ember",
      "royal",
      "verdant",
    ]);
  });

  it("each preset has a label and a gradient token (no raw hex)", () => {
    for (const theme of Object.values(profileCardThemes(en))) {
      expect(typeof theme.label).toBe("string");
      expect(theme.label.length).toBeGreaterThan(0);
      // Gradients reference --nf-grad-* tokens, never inline colours.
      expect(theme.gradient).toMatch(/^var\(--nf-grad-/);
    }
  });

  it("royal reuses the default --nf-grad-mark gradient", () => {
    expect(profileCardThemes(en).royal.gradient).toBe("var(--nf-grad-mark)");
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
