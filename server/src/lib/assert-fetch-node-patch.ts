// Side-effect module. Import it FIRST in src/index.ts, before anything that
// reaches @atproto/oauth-client-node.
//
// Under Bun, @atproto-labs/fetch-node crashes at module load unless
// patches/@atproto-labs%2Ffetch-node@0.3.7.patch is applied: undici 8's
// CacheStorage constructor calls webidl.util.markAsUncloneable, which Bun does
// not implement (nodejs/undici#5024). The failure therefore happens while the
// import graph is still evaluating, which is why this front-runs that import
// rather than checking anything from the module body — by the time a statement
// in index.ts could run, the process is already dead.
//
// Left alone, it surfaces as an undici stack trace with no hint that the real
// cause is an installer that ignored `patchedDependencies`. That cost a
// production deploy once; see #293.

// Marks the file as a module so the top-level await below is legal (TS1375);
// there is nothing to export.
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
