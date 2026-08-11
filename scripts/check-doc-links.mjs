#!/usr/bin/env bun
// Fails when a code comment points at a test that no longer exists. The
// comment policy in CLAUDE.md lets a test carry a business rule in place of
// prose, which only holds while the link resolves.
//
// Checks two forms: a markdown link to a relative path anywhere in a
// TypeScript/JavaScript comment, and Go doc links naming a test, which must
// match a `func TestName(` in the same package.
//
// The markdown form is matched across the whole comment rather than only
// where it trails a "see" tag: JSDoc wraps, so the tag and the link routinely
// land on different lines, and a link the checker cannot see is a link that
// rots silently.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "test-results",
  "playwright-report",
  ".bun",
]);

const TS_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];

export function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full));
    } else {
      found.push(full);
    }
  }
  return found;
}

function fileExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

const TS_MARKDOWN_LINK = /\[[^\]]+\]\(([^)]+)\)/g;
const TS_BARE_LINK = /@see\s+((?:\.{1,2}\/)[^\s)]+)/g;
const GO_DOC_LINK = /\[(Test[A-Za-z0-9_]+)\]/g;

const LINE_COMMENT = /^\s*\/\/(.*)$/;
const BLOCK_COMMENT_OPEN = /\/\*(.*)$/;
const BLOCK_COMMENT_CLOSE = /^(.*?)\*\//;

/**
 * Matching the whole file would read `arr[i](x)` as a markdown link, so only
 * comment text is offered to the link patterns.
 */
function commentText(source) {
  const lines = [];
  let inBlock = false;

  for (const line of source.split("\n")) {
    if (inBlock) {
      const close = line.match(BLOCK_COMMENT_CLOSE);
      if (close) {
        lines.push(close[1]);
        inBlock = false;
      } else {
        lines.push(line);
      }
      continue;
    }

    const lineComment = line.match(LINE_COMMENT);
    if (lineComment) {
      lines.push(lineComment[1]);
      continue;
    }

    const open = line.match(BLOCK_COMMENT_OPEN);
    if (open) {
      const close = open[1].match(BLOCK_COMMENT_CLOSE);
      if (close) {
        lines.push(close[1]);
      } else {
        lines.push(open[1]);
        inBlock = true;
      }
    }
  }

  return lines.join("\n");
}

// A markdown link in prose ("[the docs](https://...)", "[1](#footnote)") is not
// a file reference, so only repo-relative paths are resolved.
function isRelativePath(target) {
  return target.startsWith("./") || target.startsWith("../");
}

export function checkTypeScript(files, root = REPO_ROOT) {
  const failures = [];

  for (const file of files) {
    if (!TS_EXTENSIONS.some((ext) => file.endsWith(ext))) continue;

    const comments = commentText(readFileSync(file, "utf8"));
    const targets = new Set();

    for (const [, target] of comments.matchAll(TS_MARKDOWN_LINK)) targets.add(target);
    for (const [, target] of comments.matchAll(TS_BARE_LINK)) targets.add(target);

    for (const target of targets) {
      if (!isRelativePath(target)) continue;

      const resolved = resolve(dirname(file), target.split("#")[0]);
      if (!fileExists(resolved)) {
        failures.push(`${relative(root, file)} -> ${target} (no such file)`);
      }
    }
  }

  return failures;
}

export function checkGo(files, root = REPO_ROOT) {
  const goFiles = files.filter((file) => file.endsWith(".go"));
  const failures = [];

  // Go doc links resolve within a package, so index test functions per directory.
  const testsByDir = new Map();
  for (const file of goFiles) {
    const source = readFileSync(file, "utf8");
    const names = testsByDir.get(dirname(file)) ?? new Set();
    for (const [, name] of source.matchAll(/^func (Test[A-Za-z0-9_]+)\s*\(/gm)) {
      names.add(name);
    }
    testsByDir.set(dirname(file), names);
  }

  for (const file of goFiles) {
    if (file.endsWith("_test.go")) continue;

    const known = testsByDir.get(dirname(file)) ?? new Set();
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trimStart().startsWith("//")) continue;

      for (const [, name] of line.matchAll(GO_DOC_LINK)) {
        if (!known.has(name)) {
          failures.push(`${relative(root, file)} -> [${name}] (no such test in package)`);
        }
      }
    }
  }

  return failures;
}

if (import.meta.main) {
  const files = walk(REPO_ROOT);
  const failures = [...checkTypeScript(files), ...checkGo(files)];

  if (failures.length > 0) {
    console.error(`Broken doc links (${failures.length}):\n`);
    for (const failure of failures) console.error(`  ${failure}`);
    console.error("\nEvery link must resolve, or the rule it points at is undocumented again.");
    process.exit(1);
  }

  console.log("All doc links resolve.");
}
