import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import appTheme, { ALERT_TONES } from "../../Theme";

import { contrast, flatten, parseColor, worstOnGradient, type Rgb } from "./colorMath";
import { declaredTokens, referencedTokens, token, type Scheme } from "./readTokens";

/**
 * The palette's accessibility rules, executable.
 *
 * Every pair below is text-on-background somewhere in the UI, and WCAG AA for
 * body text is 4.5:1. Lowering a token past that is a failing test rather than a
 * regression someone notices in a screenshot months later.
 */

const AA = 4.5;
/** WCAG's relaxed threshold, for ≥24px or ≥18.66px-bold text only. */
const AA_LARGE = 3;

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Opaque page background a translucent surface has to be flattened against.
 * Mantine derives it from the theme (`theme.white` / `dark[7]`), not from
 * index.css, so it is read from the same place the browser reads it.
 */
const BODY: Record<Scheme, Rgb> = {
  light: parseColor(appTheme.white!),
  dark: parseColor(appTheme.colors!.dark![7]),
};

function surface(scheme: Scheme): Rgb {
  return flatten(token("--ds-surface", scheme), BODY[scheme]);
}

function ratio(fg: string, bg: Rgb, scheme: Scheme): number {
  return contrast(flatten(token(fg, scheme), bg), bg);
}

const SCHEMES: Scheme[] = ["light", "dark"];

describe("body text", () => {
  it.each(SCHEMES)("dimmed text clears AA on the card surface (%s)", (scheme) => {
    expect(ratio("--mantine-color-dimmed", surface(scheme), scheme)).toBeGreaterThanOrEqual(AA);
  });

  it.each(SCHEMES)("dimmed text clears AA on the page background (%s)", (scheme) => {
    expect(ratio("--mantine-color-dimmed", BODY[scheme], scheme)).toBeGreaterThanOrEqual(AA);
  });

  it.each(SCHEMES)("dimmed text clears AA on the ghost surface (%s)", (scheme) => {
    const ghost = flatten(token("--ds-surface-ghost", scheme), BODY[scheme]);
    expect(ratio("--mantine-color-dimmed", ghost, scheme)).toBeGreaterThanOrEqual(AA);
  });

  it("brand-accented body text clears AA on the light card surface", () => {
    // The plain `royal` fill is 4.4:1 here, which is why text gets its own token.
    expect(ratio("--ds-accent-text", surface("light"), "light")).toBeGreaterThanOrEqual(AA);
  });

  it.each(SCHEMES)("link colour clears AA on the card surface (%s)", (scheme) => {
    expect(ratio("--ds-link", surface(scheme), scheme)).toBeGreaterThanOrEqual(AA);
  });
});

describe("text on brand gradients", () => {
  const GRADIENTS = ["--ds-grad-mark", "--ds-grad-dark"];
  const FOREGROUNDS = ["--ds-on-grad", "--ds-on-grad-muted", "--ds-on-grad-accent"];

  it.each(GRADIENTS.flatMap((g) => FOREGROUNDS.map((f) => [g, f])))(
    "%s carries %s at AA across the whole ramp",
    (gradient, fg) => {
      // Alpha-carrying foregrounds are flattened against the gradient's own
      // lightest stop, the point where they are hardest to read.
      const grad = token(gradient);
      const lightest = worstStop(grad);
      expect(worstOnGradient(flatten(token(fg), lightest), grad)).toBeGreaterThanOrEqual(AA);
    }
  );

  it.each(["--ds-grad-aurora", "--ds-grad-ember", "--ds-grad-verdant", "--ds-grad-mark"])(
    "ask-card preset %s carries white text at AA across the whole ramp",
    (preset) => {
      expect(
        worstOnGradient(parseColor(token("--ds-on-grad")), token(preset))
      ).toBeGreaterThanOrEqual(AA);
    }
  );

  it("the faint on-gradient token is not strong enough for text", () => {
    // Pinned so nobody promotes it to a Text colour: it exists for rules and
    // progress-ring tracks, where contrast is not a legibility requirement.
    const grad = token("--ds-grad-dark");
    const fg = flatten(token("--ds-on-grad-faint"), worstStop(grad));
    expect(worstOnGradient(fg, grad)).toBeLessThan(AA_LARGE);
  });
});

describe("controls", () => {
  it("the sunshine call-to-action carries its dark ink at AA", () => {
    expect(
      contrast(parseColor(token("--ds-midnight")), parseColor(token("--ds-sunshine")))
    ).toBeGreaterThanOrEqual(AA);
  });

  it.each(SCHEMES)("filled primary buttons carry white labels at AA (%s)", (scheme) => {
    const fill = appTheme.colors!.royal![appTheme.primaryShade as number];
    expect(contrast(parseColor(appTheme.white!), parseColor(fill))).toBeGreaterThanOrEqual(AA);
    expect(scheme).toBeTruthy();
  });

  it("destructive buttons carry white labels at AA", () => {
    expect(
      contrast(parseColor(appTheme.white!), parseColor(appTheme.colors!.crimson![6]))
    ).toBeGreaterThanOrEqual(AA);
  });

  it.each(SCHEMES)("the active nav item is legible on its own tint (%s)", (scheme) => {
    const bg = flatten(token("--ds-nav-active-bg", scheme), BODY[scheme]);
    expect(ratio("--ds-nav-active-color", bg, scheme)).toBeGreaterThanOrEqual(AA);
  });
});

describe("alert tones", () => {
  const cases = SCHEMES.flatMap((scheme) =>
    Object.entries(ALERT_TONES).map(([name, tone]) => [scheme, name, tone] as const)
  );

  it.each(cases)("%s: the %s title is legible on its own tint", (scheme, _name, tone) => {
    const tint = flatten(`rgba(${tone.rgb},0.09)`, BODY[scheme]);
    expect(ratio(tone.title, tint, scheme)).toBeGreaterThanOrEqual(AA);
  });
});

describe("token hygiene", () => {
  it("declares no --ds-* token that nothing references", async () => {
    const sources = await collectSources(SRC);
    const used = referencedTokens(sources);
    const orphans = declaredTokens().filter((name) => !used.has(name));
    expect(orphans).toEqual([]);
  });

  it("references no --ds-* token that nothing declares", async () => {
    const declared = new Set(declaredTokens());
    const sources = await collectSources(SRC);
    const undeclared = [...referencedTokens(sources)].filter((name) => !declared.has(name));
    expect(undeclared).toEqual([]);
  });
});

/** The gradient stop where a translucent foreground has the least to work with. */
function worstStop(gradient: string): Rgb {
  const stops = [...gradient.matchAll(/#[0-9a-f]{3,6}/gi)].map((m) => parseColor(m[0]));
  return stops.reduce((lightest, stop) =>
    contrast(parseColor("#FFFFFF"), stop) < contrast(parseColor("#FFFFFF"), lightest)
      ? stop
      : lightest
  );
}

async function collectSources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectSources(path)));
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      out.push(readFileSync(path, "utf8"));
    }
  }
  return out;
}
