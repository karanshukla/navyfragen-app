#!/usr/bin/env bun
// #406's acceptance criterion is "the es catalog ships as its own chunk,
// asserted on build output, not eyeballed" — #410 extends the same check to
// pt/de/fr. This runs against an existing `dist/` (CI: right after "Build
// under Bun"; locally: `bun run build && bun run check:locale-chunking`)
// rather than driving the build itself, so it stays cheap and composes with
// whatever already produced `dist/`.
//
// "Own chunk" means two things, both checked here per locale: (1) some file
// under dist/assets contains that locale's marker text at all — proving it
// was built in, not silently dropped — and (2) that file is not one of the
// entry chunks index.html loads eagerly via <script type="module">. Only the
// matching dynamic `import("./<locale>")` in lib/i18n/index.tsx should pull
// it in, and only for a visitor who actually picks that language.
//
// Identified by content, not by filename: Rollup hashes and can rename chunk
// files across versions, but a real, locale-exclusive sentence stays a
// reliable fingerprint.

import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const CLIENT_ROOT = resolve(import.meta.dir, "..");
const DIST_DIR = resolve(CLIENT_ROOT, "dist");
const DIST_ASSETS = resolve(DIST_DIR, "assets");
const INDEX_HTML = resolve(DIST_DIR, "index.html");

// One phrase per locale that only exists inside that locale's catalog file —
// accented or otherwise distinctive, and not a substring any English or
// code-level string would ever contain. If one of these ever stops appearing
// in the build, either that catalog's wording changed (update the marker
// here to match) or the catalog stopped being bundled at all.
const LOCALE_MARKERS = {
  es: "no leídos",
  pt: "não lida",
  de: "Thread-Ausgangsnachricht",
  fr: "non lu",
};

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

const assetContents = new Map(
  assetFiles.map((file) => [file, readFileSync(join(DIST_ASSETS, file), "utf8")])
);

const summaries = [];
/** Locale → the dist chunk files its marker was found in. */
const chunksByLocale = new Map();

for (const [locale, marker] of Object.entries(LOCALE_MARKERS)) {
  const filesWithMarker = assetFiles.filter((file) => assetContents.get(file).includes(marker));

  if (filesWithMarker.length === 0) {
    fail(
      `no file in dist/assets contains ${JSON.stringify(marker)} — either the ${locale} catalog was not bundled, or its wording changed and this script's marker needs updating to match client/src/lib/i18n/${locale}.ts.`
    );
  }

  const markerInEntry = filesWithMarker.filter((file) => entryScripts.has(file));
  if (markerInEntry.length > 0) {
    fail(
      `the ${locale} catalog is bundled into an entry chunk (${markerInEntry.join(", ")}), not lazy-loaded into its own chunk — check the \`import("./${locale}")\` loader in client/src/lib/i18n/index.tsx.`
    );
  }

  chunksByLocale.set(locale, filesWithMarker);
  summaries.push(`${locale} (${filesWithMarker.join(", ")})`);
}

// "Own chunk" is per locale, not "some lazy chunk": Rollup is free to fold the
// four catalogs into one shared chunk, which passes both checks above while
// making a visitor who picks Spanish download German, French and Portuguese
// too. Sharing a file is what proves that happened.
for (const [locale, files] of chunksByLocale) {
  for (const [otherLocale, otherFiles] of chunksByLocale) {
    if (locale >= otherLocale) continue;
    const shared = files.filter((file) => otherFiles.includes(file));
    if (shared.length > 0) {
      fail(
        `the ${locale} and ${otherLocale} catalogs share a chunk (${shared.join(", ")}), so picking either downloads both — check the \`import("./<locale>")\` loaders in client/src/lib/i18n/index.tsx.`
      );
    }
  }
}

console.log(
  `OK: ${summaries.join(", ")} each ship in their own chunk, separate from the entry bundle (${[...entryScripts].join(", ")}).`
);
