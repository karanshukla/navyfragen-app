// Side-effect module, imported first in src/index.ts.
//
// It cannot front-run a module-load crash, and it no longer claims to. Under
// Bun the rest of index.ts's import graph evaluates before this module's body
// runs at all (verified: a console.error on line 1 never prints when booting on
// 1.3.14), so on a runtime below the floor what you actually see is undici's
// raw "webidl.util.markAsUncloneable is not a function" stack. That failure is
// loud and greppable, and docs/runtime-notes.md names it.
//
// What this module does buy: the floor check fires for anything that imports it
// without dragging in the OAuth graph first, and withFetchNodePatchDiagnostic
// below catches the case that actually still bites above the floor, an install
// that skipped patchedDependencies.

import { isBunVersionBelowFloor, MINIMUM_BUN_VERSION } from "#/lib/bun-version-floor";

const NOT_PATCHED =
  "@atproto-labs/fetch-node is not patched, so the server cannot boot under Bun.\n" +
  "\n" +
  "This almost always means dependencies were installed by npm or yarn rather\n" +
  "than bun: `patchedDependencies` in the root package.json is a Bun-only field\n" +
  "and other installers ignore it silently.\n" +
  "\n" +
  "Fix: install with `bun install`, which docker/Dockerfile.server already does.\n" +
  "On Railway, confirm the service builds from that Dockerfile rather than a\n" +
  "native/RAILPACK build — see issue #293.";

if (isBunVersionBelowFloor(process.versions.bun)) {
  throw new Error(
    `This Bun is ${process.versions.bun}; the server requires ` +
      `${MINIMUM_BUN_VERSION.join(".")} or newer.\n` +
      "\n" +
      "undici 8's CacheStorage constructor calls node:worker_threads\n" +
      ".markAsUncloneable, which Bun only implements from 1.4 onwards. On an\n" +
      "older build the @atproto-labs/fetch-node import throws while the module\n" +
      "graph is still evaluating.\n" +
      "\n" +
      "Fix: upgrade Bun. The Dockerfiles and CI workflows already pin it."
  );
}

/**
 * Rethrows the unpatched-install failure with actionable guidance. Wrap OAuth
 * client construction in this: that is where an unpatched
 * `@atproto-labs/fetch-node` first calls `unicastFetchWrap`, which throws
 * because Bun exposes no `process.versions.undici`. Above the floor the import
 * itself succeeds, so a missing patch has no earlier tell.
 */
export function withFetchNodePatchDiagnostic<T>(create: () => T): T {
  try {
    return create();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("Unicast SSRF protection requires")) throw err;
    throw new Error(NOT_PATCHED, { cause: err });
  }
}
