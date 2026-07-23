import { describe, it, expect } from "vitest";

import {
  getTouchpointTranslations,
  touchpointLocales,
  type TouchpointTranslations,
} from "../../lib/touchpointTranslations";

// Every property a locale must define, so a new locale that misses a key is
// caught by the structural check below rather than rendering undefined.
const REQUIRED_STRING_KEYS: (keyof TouchpointTranslations)[] = [
  "placeholder",
  "sendLabel",
  "disclaimer",
  "inboxClosed",
  "inboxShareTitle",
];
const REQUIRED_FN_KEYS: (keyof TouchpointTranslations)[] = [
  "headline",
  "shareTitle",
  "inboxShareText",
];

describe("touchpointTranslations (#266)", () => {
  it("exposes the supported locale set with en first (default)", () => {
    expect(touchpointLocales[0]).toEqual({ value: "en", label: "English" });
    const values = touchpointLocales.map((l) => l.value);
    expect(values).toEqual(["en", "es", "pt", "de", "fr"]);
  });

  it("every locale defines every touchpoint", () => {
    for (const { value } of touchpointLocales) {
      const t = getTouchpointTranslations(value);
      for (const key of REQUIRED_STRING_KEYS) {
        const v = t[key];
        expect(typeof v).toBe("string");
        expect((v as string).length).toBeGreaterThan(0);
      }
      for (const key of REQUIRED_FN_KEYS) {
        expect(typeof t[key]).toBe("function");
      }
    }
  });

  it("every parameterized touchpoint returns a non-empty string for every locale", () => {
    // Invoke each function for each locale so every locale object's function
    // bodies are covered (not just en/es).
    for (const { value } of touchpointLocales) {
      const t = getTouchpointTranslations(value);
      for (const key of REQUIRED_FN_KEYS) {
        const fn = t[key] as (name: string) => string;
        const result = fn("Name");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    }
  });

  it("parameterized touchpoints interpolate the display name", () => {
    const t = getTouchpointTranslations("en");
    expect(t.headline("Ada")).toBe("Send Ada an anonymous message");
    expect(t.shareTitle("Ada")).toBe("Send Ada an anonymous message");
    expect(t.inboxShareText("Ada")).toBe("Send Ada anonymous messages!");
  });

  it("returns English for null (the unset default)", () => {
    const t = getTouchpointTranslations(null);
    expect(t.sendLabel).toBe("Send");
    expect(t.placeholder).toBe("Ask something…");
  });

  it("falls back to English for an unknown locale rather than throwing", () => {
    const t = getTouchpointTranslations("xx");
    expect(t.sendLabel).toBe("Send");
  });

  it("falls back to English for undefined", () => {
    const t = getTouchpointTranslations(undefined);
    expect(t.sendLabel).toBe("Send");
  });

  it("returns distinct copy for a non-English locale", () => {
    // Sanity check that the table actually localizes — not just en under
    // every key. Spanish send label is "Enviar".
    const t = getTouchpointTranslations("es");
    expect(t.sendLabel).toBe("Enviar");
    expect(t.headline("Ada")).toBe("Envía a Ada un mensaje anónimo");
  });
});
