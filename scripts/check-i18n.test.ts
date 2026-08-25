import assert from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, test } from "bun:test";

import {
  checkFile,
  isLocaleCatalog,
  isOwnLineJsxText,
  staticTextOf,
  stripComments,
  walk,
} from "./check-i18n.mjs";

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
    const failures = failuresFor("Foo.tsx", `if (error.name === "AbortError") return;\n`);
    assert.deepStrictEqual(failures, []);
  });
});

describe("template literals as prose candidates", () => {
  test("flags a template literal that starts with prose", () => {
    const failures = failuresFor("Foo.tsx", "const title = `Not on ${APP_NAME}`;\n");
    assert.strictEqual(failures.length, 1);
    assert.match(failures[0], /Foo\.tsx:1/);
  });

  // The blind spot #402's review caught: interpolation *first* means there is
  // no leading static char to test "starts uppercase" against, so only the
  // "contains a space" half of the heuristic catches it — and it must.
  test("flags a template literal whose prose follows a leading interpolation", () => {
    const failures = failuresFor(
      "Settings.tsx",
      "const description = `${APP_NAME} syncs your data to a PDS.`;\n"
    );
    assert.strictEqual(failures.length, 1);
  });

  test("accepts a template literal with no static prose (id/URL composition)", () => {
    const failures = failuresFor(
      "Foo.tsx",
      "const id = `message-card-${tid}`;\nconst ratio = `${value.length}/${limit}`;\n"
    );
    assert.deepStrictEqual(failures, []);
  });

  test("reduces a template literal to its static text before testing, ignoring the expression source", () => {
    // The interpolated expression contains a space and looks prose-shaped,
    // but it is code, not copy — only "px, " (the static text) should count.
    const failures = failuresFor(
      "Foo.tsx",
      "el.style.transform = `translate(${state.x + offset}px)`;\n"
    );
    assert.deepStrictEqual(failures, []);
  });

  test("accepts a CSS-shaped template literal under an allowlisted property name", () => {
    const failures = failuresFor(
      "Foo.tsx",
      "const style = { border: `1px solid ${onGradBorder}` };\n"
    );
    assert.deepStrictEqual(failures, []);
  });

  test("still rejects prose under an unrelated property of the same value shape", () => {
    const failures = failuresFor("Foo.tsx", "const style = { caption: `1px solid the border` };\n");
    assert.strictEqual(failures.length, 1);
  });

  test("captures the attribute name through JSX's `attr={` + backtick wrapping", () => {
    // JSX never allows a bare backtick as an attribute value — it is always
    // `attr={\`...\`}` — so the name-capture has to see through the `{`.
    const failures = failuresFor(
      "CharRing.tsx",
      "<svg viewBox={`0 0 ${SIZE} ${SIZE}`} transform={`rotate(-90 ${C} ${C})`} />;\n"
    );
    assert.deepStrictEqual(failures, []);
  });

  test("a JSX attribute template literal with real prose is still flagged despite the `{`", () => {
    const failures = failuresFor("Foo.tsx", "<Alert title={`Not on ${APP_NAME}`} />;\n");
    assert.strictEqual(failures.length, 1);
  });

  test("respects i18n-allow on a template literal", () => {
    const failures = failuresFor("Foo.tsx", "const x = `Not on ${APP_NAME}` /* i18n-allow */;\n");
    assert.deepStrictEqual(failures, []);
  });
});

describe("the i18n-allow escape hatch", () => {
  test("accepts a flagged literal marked i18n-allow on the same line", () => {
    const failures = failuresFor("Foo.tsx", `{ label: "English" /* i18n-allow */ }\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("does not suppress a violation on a different line", () => {
    const failures = failuresFor("Foo.tsx", `// i18n-allow\nconst title = "Not logged in";\n`);
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
    const failures = failuresFor("Foo.tsx", `const x = /* noted */ "Not logged in";\n`);
    assert.strictEqual(failures.length, 1);
  });
});

describe("locale catalogs are exempt whole", () => {
  test("a file ending in `satisfies Messages` reports nothing", () => {
    const failures = failuresFor(
      "lib/i18n/de.ts",
      `export const de = { greeting: "Guten Tag" } satisfies Messages;
`
    );
    assert.deepStrictEqual(failures, []);
  });

  test("a file merely mentioning Messages is still checked", () => {
    const failures = failuresFor(
      "lib/i18n/apiErrors.ts",
      `import type { Messages } from "./types";
const fallback = "Something went wrong";
`
    );
    assert.strictEqual(failures.length, 1);
  });

  test("isLocaleCatalog needs the satisfies keyword, not just the type name", () => {
    assert.ok(isLocaleCatalog(`} satisfies Messages;`));
    assert.ok(!isLocaleCatalog(`function f(m: Messages) {}`));
  });
});

describe("identifier vocabulary is never prose", () => {
  test("accepts a SCREAMING_SNAKE error code", () => {
    const failures = failuresFor(
      "lib/contracts.ts",
      `const codes = ["NOT_AUTHENTICATED"];
`
    );
    assert.deepStrictEqual(failures, []);
  });

  test("accepts an all-caps tagName comparison", () => {
    const failures = failuresFor(
      "lib/nav.ts",
      `const skip = ["INPUT", "TEXTAREA"];
`
    );
    assert.deepStrictEqual(failures, []);
  });

  test("accepts a header name and a feature-detection key", () => {
    const failures = failuresFor(
      "api/client.ts",
      `const h = { "Content-Type": "application/json" };
if ("PushManager" in window) {}
`
    );
    assert.deepStrictEqual(failures, []);
  });

  test("still flags a capitalized sentence that only looks like an identifier", () => {
    const failures = failuresFor(
      "lib/foo.ts",
      `const m = "NO_SUCH thing happened";
`
    );
    assert.strictEqual(failures.length, 1);
  });
});

describe("JSX text children", () => {
  test("flags a text child on its own line", () => {
    const failures = failuresFor(
      "NotFound.tsx",
      `<Text c="dimmed" mt="md">\n  The requested resource was not found.\n</Text>\n`
    );
    assert.strictEqual(failures.length, 1);
    assert.match(failures[0], /NotFound\.tsx:2/);
  });

  test("flags a digit-leading title, which the literal rules would miss", () => {
    const failures = failuresFor(
      "NotFound.tsx",
      `<Title order={2}>\n  404 - Not Found\n</Title>\n`
    );
    assert.strictEqual(failures.length, 1);
  });

  test("flags an inline text child", () => {
    const failures = failuresFor("Overview.tsx", `<Text fw={700}>Account Overview</Text>\n`);
    assert.strictEqual(failures.length, 1);
  });

  test("accepts an interpolated child, which is already catalogued", () => {
    const failures = failuresFor("Overview.tsx", `<Text>{messages.notFoundPage.title}</Text>\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("a generic type argument is not a text child", () => {
    const failures = failuresFor(
      "loaders.tsx",
      `const LOADERS: Record<string, () => Promise<Messages>> = {};\n`
    );
    assert.deepStrictEqual(failures, []);
  });

  test("a comparison operator is not a text child", () => {
    const failures = failuresFor("scroll.tsx", `if (rect.bottom <= window.innerHeight) {}\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("a handle on its own line has no space and is left alone", () => {
    const failures = failuresFor("Home.tsx", `<Text>\n  @navyfragen.app\n</Text>\n`);
    assert.deepStrictEqual(failures, []);
  });

  test("the i18n-allow escape hatch covers a text child too", () => {
    const failures = failuresFor(
      "Overview.tsx",
      `<Text>Account Overview</Text> {/* i18n-allow */}\n`
    );
    assert.deepStrictEqual(failures, []);
  });
});

describe("isOwnLineJsxText", () => {
  test("needs an opening tag above and a closing tag below", () => {
    assert.ok(isOwnLineJsxText("<Text>", "  Some words here", "</Text>"));
    assert.ok(!isOwnLineJsxText("const x = 1;", "  Some words here", "</Text>"));
    assert.ok(!isOwnLineJsxText("<Text>", "  Some words here", "more code"));
  });

  test("rejects a line carrying code punctuation", () => {
    assert.ok(!isOwnLineJsxText("<Text>", "  doThing();", "</Text>"));
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
      `const url = "https://example.test/path";\nconst title = "Not logged in";\n`
    );
    // The URL line has no space, so it is not prose-shaped and stays clean —
    // but stripComments must not eat line 2 just because line 1 contains "//".
    assert.strictEqual(failures.length, 1);
    assert.ok(failures[0].includes(":2:"));
    assert.ok(failures[0].includes("Not logged in"));
  });
});

describe("staticTextOf", () => {
  test("strips a single trailing interpolation", () => {
    assert.strictEqual(staticTextOf("Not on ${APP_NAME}"), "Not on ");
  });

  test("strips a single leading interpolation", () => {
    assert.strictEqual(staticTextOf("${APP_NAME} syncs your data."), " syncs your data.");
  });

  test("strips multiple interpolations, keeping every static run", () => {
    assert.strictEqual(staticTextOf("${a} of ${b} on"), " of  on");
  });

  test("does not desync on an expression containing braces", () => {
    assert.strictEqual(staticTextOf("${a ? {x:1}.x : 0}-c"), "-c");
  });

  test("returns an empty string when the whole literal is one expression", () => {
    assert.strictEqual(staticTextOf("${value}"), "");
  });
});

describe("walk", () => {
  test("collects both .ts and .tsx, and nothing else", () => {
    write("Foo.tsx", "");
    write("bar.ts", "");
    write("readme.md", "");
    write("logo.svg", "");
    const found = walk(srcDir)
      .map((file) => basename(file))
      .sort();
    assert.deepStrictEqual(found, ["Foo.tsx", "bar.ts"]);
  });

  test("skips a .styles.ts file, whose values are CSS", () => {
    write("Foo.tsx", "");
    write("Foo.styles.ts", "");
    const found = walk(srcDir);
    assert.strictEqual(found.length, 1);
    assert.ok(found[0].endsWith("Foo.tsx"));
  });

  test("skips the touchpoint catalog, which is the other locale axis", () => {
    write("lib/touchpointTranslations.ts", "");
    write("lib/other.ts", "");
    const found = walk(srcDir);
    assert.strictEqual(found.length, 1);
    assert.ok(found[0].endsWith("other.ts"));
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
