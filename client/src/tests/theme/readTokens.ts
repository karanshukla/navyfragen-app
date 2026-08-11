import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reads the design tokens back out of `src/index.css`.
 *
 * The stylesheet is the source of truth, so the contrast suite parses it rather
 * than re-listing the hexes in TypeScript — a duplicated palette would drift and
 * the tests would keep passing against values the app no longer uses.
 */

const CSS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../index.css");

export type Scheme = "light" | "dark";

const SELECTORS: Record<Scheme, string[]> = {
  light: [":root", ':root[data-mantine-color-scheme="light"]'],
  dark: [':root[data-mantine-color-scheme="dark"]'],
};

/**
 * Merges every rule block whose selector is exactly the scheme's, in source
 * order. Selector and body are captured together so back-to-back blocks both
 * match — anchoring on the preceding `}` swallows it and drops the next one.
 */
function declarationsFor(css: string, scheme: Scheme): Map<string, string> {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map<string, string>();
  for (const block of source.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (!SELECTORS[scheme].includes(block[1].trim())) continue;
    for (const decl of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      out.set(decl[1], decl[2].replace(/\s+/g, " ").trim());
    }
  }
  return out;
}

const css = readFileSync(CSS_PATH, "utf8");
const declarations: Record<Scheme, Map<string, string>> = {
  light: declarationsFor(css, "light"),
  dark: declarationsFor(css, "dark"),
};

/**
 * Resolves a token to a literal colour, following `var()` indirection. Dark
 * lookups fall back to the light block, mirroring the cascade: the dark selector
 * only overrides what actually differs.
 */
export function token(name: string, scheme: Scheme = "light"): string {
  const seen = new Set<string>();
  let value = name;

  while (value.startsWith("--") || value.startsWith("var(")) {
    const key = value.startsWith("var(") ? /var\((--[\w-]+)\)/.exec(value)![1] : value;
    if (seen.has(key)) throw new Error(`Cyclic token reference at ${key}`);
    seen.add(key);

    const next =
      (scheme === "dark" ? declarations.dark.get(key) : undefined) ?? declarations.light.get(key);
    if (next === undefined) throw new Error(`Undefined token ${key} (${scheme})`);
    value = next;
  }
  return value;
}

/** Every `--nf-*` token declared anywhere in the stylesheet. */
export function declaredTokens(): string[] {
  return [...new Set([...declarations.light.keys(), ...declarations.dark.keys()])].filter((k) =>
    k.startsWith("--nf-")
  );
}

/** Every `--nf-*` token *referenced* from TS/TSX/CSS sources. */
export function referencedTokens(sources: string[]): Set<string> {
  const used = new Set<string>();
  for (const source of sources) {
    for (const m of source.matchAll(/var\((--nf-[\w-]+)\)/g)) used.add(m[1]);
  }
  return used;
}

export const stylesheet = css;
