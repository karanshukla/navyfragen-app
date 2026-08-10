import assert from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "bun:test";

import { checkGo, checkTypeScript, walk } from "./check-doc-links.mjs";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "doc-links-"));
  mkdirSync(join(root, "tests"));
  writeFileSync(join(root, "tests", "real.test.ts"), "");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(name: string, source: string) {
  writeFileSync(join(root, name), source);
}

// Assembled rather than written literally: this file is itself scanned by the
// checker, and a literal block-comment fixture would read as a real comment.
const SLASH = "/";
const STAR = "*";

function jsdoc(...lines: string[]) {
  return [`${SLASH}${STAR}${STAR}`, ...lines.map((line) => ` ${STAR} ${line}`), ` ${STAR}${SLASH}`]
    .join("\n")
    .concat("\n");
}

function tsFailures() {
  return checkTypeScript(walk(root), root);
}

function goFailures() {
  return checkGo(walk(root), root);
}

describe("markdown links in TypeScript comments", () => {
  test("accepts a link whose target exists", () => {
    write("src.ts", jsdoc("@see [real.test.ts](./tests/real.test.ts) pins the rule."));
    assert.deepStrictEqual(tsFailures(), []);
  });

  test("rejects a link whose target was renamed away", () => {
    write("src.ts", jsdoc("@see [gone.test.ts](./tests/gone.test.ts) pins the rule."));
    assert.match(tsFailures().join("\n"), /src\.ts -> \.\/tests\/gone\.test\.ts/);
  });

  test("rejects a broken link when JSDoc wraps the tag onto its own line", () => {
    write("src.ts", jsdoc("@see", "[gone.test.ts](./tests/gone.test.ts) pins the rule."));
    assert.strictEqual(tsFailures().length, 1);
  });

  test("rejects a broken link written as prose, with no tag at all", () => {
    write("src.ts", `// See [gone.test.ts](./tests/gone.test.ts) for the boundary pair.\n`);
    assert.strictEqual(tsFailures().length, 1);
  });

  test("ignores a link-shaped string literal outside a comment", () => {
    write("src.ts", `const template = "[gone.test.ts](./tests/gone.test.ts)";\n`);
    assert.deepStrictEqual(tsFailures(), []);
  });

  test("ignores targets that are not repo-relative paths", () => {
    write(
      "src.ts",
      ["// [the docs](https://example.test/docs)", "// [1](#footnote)"].join("\n") + "\n"
    );
    assert.deepStrictEqual(tsFailures(), []);
  });
});

describe("Go doc links naming a test", () => {
  const goSource = (link: string) => `package shim\n\n// ${link} pins the rule.\nfunc Run() {}\n`;
  const goTest = `package shim\n\nfunc TestRunPinsTheRule(t *testing.T) {}\n`;

  test("accepts a doc link matching a test in the same package", () => {
    write("run.go", goSource("[TestRunPinsTheRule]"));
    write("run_test.go", goTest);
    assert.deepStrictEqual(goFailures(), []);
  });

  test("rejects a doc link naming a test that no longer exists", () => {
    write("run.go", goSource("[TestRunUnderTheOldName]"));
    write("run_test.go", goTest);
    assert.match(goFailures().join("\n"), /run\.go -> \[TestRunUnderTheOldName\]/);
  });

  test("rejects a doc link whose test lives in another package", () => {
    write("run.go", goSource("[TestRunPinsTheRule]"));
    mkdirSync(join(root, "other"));
    write(join("other", "run_test.go"), goTest);
    assert.strictEqual(goFailures().length, 1);
  });
});
