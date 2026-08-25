#!/usr/bin/env bun
// Fails when a .tsx file under client/src holds a bare string literal that
// looks like English prose — #402 moved the client's UI copy into the i18n
// catalog (client/src/lib/i18n/en.ts), so a new one belongs there too, not
// scattered back through JSX attributes and object properties.
//
// Heuristic, not a parser: a string literal counts as prose if it starts
// uppercase or contains a space, the same reproduction grep #402's own issue
// used to find the ~210 strings this replaced. Template literals count too —
// interpolating `${APP_NAME}` into a sentence is a reason to catalog the
// string as a function, not a reason to exempt it — evaluated against their
// *static* text (the parts outside `${...}`), so `${x}/${y}` reads as empty
// and `Not on ${APP_NAME}` reads as "Not on ". A handful of positions are
// genuinely never prose — an SVG path's `d` or `viewBox`, a `rel` attribute,
// a `transform` or `border` CSS value, a `fontFamily` value — and are
// allowlisted by name, as are a few recurring technical values
// (`KeyboardEvent.key`, `DOMException.name`) allowlisted by exact match.
// Anything else gets `/* i18n-allow */` on the same line: explicit, and
// `grep -rn i18n-allow` finds every exception.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const CLIENT_SRC = resolve(REPO_ROOT, "client", "src");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "test-results",
  "playwright-report",
  ".bun",
  "tests",
]);

export function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full));
    } else if (entry.name.endsWith(".tsx")) {
      found.push(full);
    }
  }
  return found;
}

// Position names whose value is never prose regardless of shape: an SVG
// path's `d` or `viewBox`, a link's `rel`, a Mantine theme's `fontFamily`,
// and the `transform`/`border` CSS values that are the template-literal
// equivalent of the same problem (`` `1px solid ${x}` `` starts with a digit
// but "1px solid " still contains the space that trips the heuristic).
const ALLOWED_POSITION_NAMES = new Set([
  "rel",
  "d",
  "viewBox",
  "fontFamily",
  "transform",
  "border",
  "borderTop",
]);

// Exact values that are technical vocabulary, not UI copy: KeyboardEvent.key
// comparisons and DOMException.name checks.
const ALLOWED_EXACT_VALUES = new Set([
  "Escape",
  "Enter",
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "AbortError",
]);

const ESCAPE_MARKER = "i18n-allow";

// Matches a double-quoted string literal, optionally preceded by the
// `name:` or `name=` it is the value of — a JSX attribute or an object
// property, the two positions #402's in-scope rule cares about.
const STRING_LITERAL = /(?:([A-Za-z][\w-]*)\s*[:=]\s*)?"((?:[^"\\]|\\.)*)"/g;

// Same idea, backtick-delimited — plus an optional `{`, since JSX never
// allows a bare backtick as an attribute value: `viewBox={\`...\`}`, not
// `viewBox=\`...\``. Single-line only — this codebase has no multi-line
// template literals in client/src/**/*.tsx today (checked via an
// even-backtick-count scan per file), and a line-based checker can't see
// across a line break anyway.
const TEMPLATE_LITERAL = /(?:([A-Za-z][\w-]*)\s*[:=]\s*\{?\s*)?`((?:[^`\\]|\\.)*)`/g;

function looksLikeProse(value) {
  if (value.length < 4) return false;
  return /^[A-Z]/.test(value) || value.includes(" ");
}

// The parts of a template literal outside `${...}` — brace-depth aware, so
// an expression that itself contains braces (`${a ? {x:1}.x : 0}`) doesn't
// desync the scan. `Not on ${APP_NAME}` reduces to "Not on "; `${x}/${y}`
// reduces to "/".
export function staticTextOf(templateContent) {
  let out = "";
  let depth = 0;

  for (let i = 0; i < templateContent.length; i++) {
    const ch = templateContent[i];
    if (depth === 0 && ch === "$" && templateContent[i + 1] === "{") {
      depth = 1;
      i++;
      continue;
    }
    if (depth > 0) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      continue;
    }
    out += ch;
  }

  return out;
}

// Blanks out line and block comments (line breaks kept, so line numbers
// still line up) without disturbing string content — a URL or a comment
// marker living inside a string literal must not be read as a real comment.
export function stripComments(source) {
  let out = "";
  let inBlockComment = false;
  let inLineComment = false;
  let inString = null;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      out += ch === "\n" ? ch : " ";
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      out += ch === "\n" ? ch : " ";
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        out += " ";
        i++;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      out += "  ";
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      out += "  ";
      i++;
      continue;
    }
    out += ch;
  }

  return out;
}

export function checkFile(file, root = REPO_ROOT) {
  const failures = [];
  const source = readFileSync(file, "utf8");
  const originalLines = source.split("\n");
  const codeLines = stripComments(source).split("\n");

  codeLines.forEach((line, index) => {
    if (originalLines[index].includes(ESCAPE_MARKER)) return;

    for (const match of line.matchAll(STRING_LITERAL)) {
      const [, name, value] = match;
      if (!looksLikeProse(value)) continue;
      if (name && ALLOWED_POSITION_NAMES.has(name)) continue;
      if (ALLOWED_EXACT_VALUES.has(value)) continue;
      failures.push(`${relative(root, file)}:${index + 1}: "${value}"`);
    }

    for (const match of line.matchAll(TEMPLATE_LITERAL)) {
      const [, name, content] = match;
      const staticText = staticTextOf(content);
      if (!looksLikeProse(staticText)) continue;
      if (name && ALLOWED_POSITION_NAMES.has(name)) continue;
      failures.push(`${relative(root, file)}:${index + 1}: \`${content}\``);
    }
  });

  return failures;
}

if (import.meta.main) {
  const files = walk(CLIENT_SRC);
  const failures = files.flatMap((file) => checkFile(file));

  if (failures.length > 0) {
    console.error(`Bare prose string literals (${failures.length}):\n`);
    for (const failure of failures) console.error(`  ${failure}`);
    console.error(
      "\nMove the string into client/src/lib/i18n/en.ts, or mark the line `/* i18n-allow */` if it is genuinely not user-facing prose."
    );
    process.exit(1);
  }

  console.log("No bare prose string literals found.");
}
