import assert from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "bun:test";

import { checkFile, stripComments, walk } from "./check-i18n.mjs";

let root: string;
let srcDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "check-i18n-"));
  srcDir = join(root, "client", "src");
  mkdirSync(srcDir, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(relPath: string, source: string) {
  const full = join(srcDir, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, source);
  return full;
}

function failuresFor(relPath: string, source: string): string[] {
  return checkFile(write(relPath, source), root);
}

describe("looksLikeProse via checkFile", () => {
  test("flags a capitalized JSX attribute value", () => {
    const failures = failuresFor("Foo.tsx", `<Alert title="Not logged in" />;\n`);
    assert.strictEqual(failures.length, 1);
    assert.match(failures[0], /Foo\.tsx:1/);
  });

  test("flags a lowercase-but-multi-word object property value", () => {
    const failures = failuresFor(
      "Foo.tsx",
      `notifications.show({ message: "please try again" });\n`
    );
    assert.strictEqual(failures.length, 1);
  });

  test("accepts a single lowercase word (no space, not capitalized)", () => {
    const failures = failuresFor("Foo.tsx", `<Button color="red">retry</Button>;\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("accepts a string shorter than 4 characters", () => {
    const failures = failuresFor("Foo.tsx", `const label = "Add";\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("rejects a bare prose literal with no attribute or property name", () => {
    const failures = failuresFor("Foo.tsx", `throw new Error("Something went wrong");\n`);
    assert.strictEqual(failures.length, 1);
  });
});

describe("allowlisted positions and values", () => {
  test("accepts an SVG path's d attribute", () => {
    const failures = failuresFor("Icon.tsx", `<path d="M88 70 Q100 56 112 70" />;\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("accepts a rel attribute", () => {
    const failures = failuresFor("Link.tsx", `<a rel="noopener noreferrer" href={url} />;\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("accepts a fontFamily property", () => {
    const failures = failuresFor("Theme.tsx", `{ fontFamily: "Inter, system-ui, sans-serif" }\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("still rejects a prose value under an unrelated property of the same name shape", () => {
    const failures = failuresFor("Foo.tsx", `<Alert relabel="Not logged in" />;\n`);
    assert.strictEqual(failures.length, 1);
  });

  test("accepts an exact-match technical value (KeyboardEvent.key)", () => {
    const failures = failuresFor(
      "Foo.tsx",
      `if (e.key === "Escape") onEscape();\nif (e.key === "ArrowDown") onDown();\n`
    );
    assert.deepStrictEqual(failures, []);
  });

  test("accepts an exact-match technical value (DOMException.name)", () => {
    const failures = failuresFor(
      "Foo.tsx",
      `if (error.name === "AbortError") return;\n`
    );
    assert.deepStrictEqual(failures, []);
  });
});

describe("the i18n-allow escape hatch", () => {
  test("accepts a flagged literal marked i18n-allow on the same line", () => {
    const failures = failuresFor(
      "Foo.tsx",
      `{ label: "English" /* i18n-allow */ }\n`
    );
    assert.deepStrictEqual(failures, []);
  });

  test("does not suppress a violation on a different line", () => {
    const failures = failuresFor(
      "Foo.tsx",
      `// i18n-allow\nconst title = "Not logged in";\n`
    );
    assert.strictEqual(failures.length, 1);
  });
});

describe("comments never count as code", () => {
  test("ignores a prose-shaped string inside a line comment", () => {
    const failures = failuresFor("Foo.tsx", `// title="Not logged in"\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("ignores a prose-shaped string inside a block/JSDoc comment", () => {
    const failures = failuresFor(
      "Foo.tsx",
      `/**\n * on whether the modifier read "Alt/Cmd" or "Alt/Something".\n */\n`
    );
    assert.deepStrictEqual(failures, []);
  });

  test("ignores a prose-shaped string inside a JSX comment", () => {
    const failures = failuresFor("Foo.tsx", `{/* renders above "Add account" */}\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("still flags real code following a stripped block comment on the same line", () => {
    const failures = failuresFor(
      "Foo.tsx",
      `const x = /* noted */ "Not logged in";\n`
    );
    assert.strictEqual(failures.length, 1);
  });
});

describe("stripComments", () => {
  test("preserves line count", () => {
    const source = `const a = 1;\n// comment\nconst b = /* inline */ 2;\n`;
    assert.strictEqual(stripComments(source).split("\n").length, source.split("\n").length);
  });

  test("does not treat // inside a string literal as a comment", () => {
    const failures = failuresFor(
      "Foo.tsx",
      `const url = "https://example.test/not prose";\nconst title = "Not logged in";\n`
    );
    // The URL line is excluded from the reproduction grep by convention
    // upstream (leading "https"), but stripComments must not eat the second
    // line just because the first contains "//".
    assert.strictEqual(failures.length, failures.filter((f) => f.includes(":2:")).length);
    assert.ok(failures.some((f) => f.includes("Not logged in")));
  });
});

describe("walk", () => {
  test("only collects .tsx files", () => {
    write("Foo.tsx", "");
    write("bar.ts", "");
    write("styles.styles.ts", "");
    const found = walk(srcDir);
    assert.strictEqual(found.length, 1);
    assert.ok(found[0].endsWith("Foo.tsx"));
  });

  test("skips a tests directory at any depth", () => {
    write("Foo.tsx", `const x = "Not translated";\n`);
    write("tests/Foo.test.tsx", `const x = "Not translated";\n`);
    const found = walk(srcDir);
    assert.strictEqual(found.length, 1);
    assert.ok(found[0].endsWith("Foo.tsx"));
    assert.ok(!found[0].includes("tests"));
  });
});
