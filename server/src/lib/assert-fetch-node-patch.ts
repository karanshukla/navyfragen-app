// Side-effect module — import it FIRST in src/index.ts. Unpatched, undici 8's
// CacheStorage constructor throws under Bun (nodejs/undici#5024) while the
// import graph is still evaluating, so this has to front-run that import rather
// than check anything from its own body. The thrown message explains the fix.

// Present so the top-level await below is legal (TS1375); nothing to export.
export {};

try {
  await import("@atproto/oauth-client-node");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!message.includes("markAsUncloneable")) throw err;

  throw new Error(
    "@atproto-labs/fetch-node is not patched, so the server cannot boot under Bun.\n" +
      "\n" +
      "This almost always means dependencies were installed by npm or yarn rather\n" +
      "than bun: `patchedDependencies` in the root package.json is a Bun-only field\n" +
      "and other installers ignore it silently.\n" +
      "\n" +
      "Fix: install with `bun install`, which docker/Dockerfile.server already does.\n" +
      "On Railway, confirm the service builds from that Dockerfile rather than a\n" +
      "native/RAILPACK build — see issue #293.",
    { cause: err }
  );
}
