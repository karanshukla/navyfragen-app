#!/usr/bin/env bun
// #406's acceptance criterion is "the es catalog ships as its own chunk,
// asserted on build output, not eyeballed". This runs against an existing
// `dist/` (CI: right after "Build under Bun"; locally: `bun run build && bun
// run check:locale-chunking`) rather than driving the build itself, so it
// stays cheap and composes with whatever already produced `dist/`.
//
// "Own chunk" means two things, both checked here: (1) some file under
// dist/assets contains the es catalog's text at all — proving it was built
// in, not silently dropped — and (2) that file is not one of the entry
// chunks index.html loads eagerly via <script type="module">. Only the
// dynamic `import("./es")` in lib/i18n/index.tsx should pull it in, and only
// for a visitor who actually picks Spanish.
//
// Identified by content, not by filename: Rollup hashes and can rename chunk
// files across versions, but a real Spanish sentence stays a reliable,
// locale-exclusive fingerprint.

import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const CLIENT_ROOT = resolve(import.meta.dir, "..");
const DIST_DIR = resolve(CLIENT_ROOT, "dist");
const DIST_ASSETS = resolve(DIST_DIR, "assets");
const INDEX_HTML = resolve(DIST_DIR, "index.html");

// A phrase that only exists inside client/src/lib/i18n/es.ts — plural,
// accented, and not a substring any English or code-level string would ever
// contain. If this ever stops appearing in the build, either es.ts's wording
// changed (update the marker) or the catalog stopped being bundled at all.
const ES_MARKER = "no leídos";

function fail(message) {
  console.error(`check:locale-chunking: ${message}`);
  process.exit(1);
}

let assetFiles;
try {
  assetFiles = readdirSync(DIST_ASSETS).filter((file) => extname(file) === ".js");
} catch {
  fail(`could not read ${DIST_ASSETS} — run \`bun run build\` first.`);
}

let indexHtml;
try {
  indexHtml = readFileSync(INDEX_HTML, "utf8");
} catch {
  fail(`could not read ${INDEX_HTML} — run \`bun run build\` first.`);
}

const entryScripts = new Set(
  [...indexHtml.matchAll(/<script[^>]*type="module"[^>]*src="\/assets\/([^"]+)"/g)].map(
    (match) => match[1]
  )
);
if (entryScripts.size === 0) {
  fail('found no entry <script type="module"> tags in dist/index.html.');
}

const filesWithMarker = assetFiles.filter((file) =>
  readFileSync(join(DIST_ASSETS, file), "utf8").includes(ES_MARKER)
);

if (filesWithMarker.length === 0) {
  fail(
    `no file in dist/assets contains ${JSON.stringify(ES_MARKER)} — either the es catalog was not bundled, or its wording changed and this script's marker needs updating to match client/src/lib/i18n/es.ts.`
  );
}

const markerInEntry = filesWithMarker.filter((file) => entryScripts.has(file));
if (markerInEntry.length > 0) {
  fail(
    `the Spanish catalog is bundled into an entry chunk (${markerInEntry.join(", ")}), not lazy-loaded into its own chunk — check the \`import("./es")\` loader in client/src/lib/i18n/index.tsx.`
  );
}

console.log(
  `OK: es catalog ships in its own chunk (${filesWithMarker.join(", ")}), separate from the entry bundle (${[...entryScripts].join(", ")}).`
);
