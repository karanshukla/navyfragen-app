#!/usr/bin/env bun
// Fails when a code comment points at a test that no longer exists. The
// comment policy in CLAUDE.md lets a test carry a business rule in place of
// prose, which only holds while the link resolves.
//
// Checks two forms: the TypeScript JSDoc "see" tag followed by a markdown link
// to a relative path, and Go doc links naming a test, which must match a
// `func TestName(` in the same package.

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

function walk(dir) {
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

// A markdown link after the tag, plus the bare relative-path form.
const TS_MARKDOWN_LINK = /@see\s+\[[^\]]+\]\(([^)]+)\)/g;
const TS_BARE_LINK = /@see\s+((?:\.{1,2}\/)[^\s)]+)/g;
const GO_DOC_LINK = /\[(Test[A-Za-z0-9_]+)\]/g;

function checkTypeScript(files) {
  const failures = [];

  for (const file of files) {
    if (!TS_EXTENSIONS.some((ext) => file.endsWith(ext))) continue;

    const source = readFileSync(file, "utf8");
    const targets = new Set();

    for (const [, target] of source.matchAll(TS_MARKDOWN_LINK)) targets.add(target);
    for (const [, target] of source.matchAll(TS_BARE_LINK)) targets.add(target);

    for (const target of targets) {
      if (/^[a-z]+:\/\//.test(target) || target.startsWith("#")) continue;

      const resolved = resolve(dirname(file), target.split("#")[0]);
      if (!fileExists(resolved)) {
        failures.push(`${relative(REPO_ROOT, file)} -> ${target} (no such file)`);
      }
    }
  }

  return failures;
}

function checkGo(files) {
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
          failures.push(`${relative(REPO_ROOT, file)} -> [${name}] (no such test in package)`);
        }
      }
    }
  }

  return failures;
}

const files = walk(REPO_ROOT);
const failures = [...checkTypeScript(files), ...checkGo(files)];

if (failures.length > 0) {
  console.error(`Broken doc links (${failures.length}):\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("\nEvery @see must resolve, or the rule it points at is undocumented again.");
  process.exit(1);
}

console.log("All doc links resolve.");
