/**
 * The server requires Bun 1.4+: the patched `@atproto-labs/fetch-node` imports
 * `undici_v8` statically, and undici 8's `CacheStorage` constructor calls
 * `node:worker_threads.markAsUncloneable`, which Bun only implements from 1.4.
 *
 * The floor is pinned by
 * [bun-version-floor.test.ts](../tests/bun-version-floor.test.ts), which asserts
 * 1.3.14 is rejected and 1.4.0 accepted.
 */
export const MINIMUM_BUN_VERSION = [1, 4] as const;

/**
 * `undefined` (not running under Bun) reads as "not below the floor", since the
 * check exists to explain a Bun-specific crash rather than to police runtimes.
 */
export function isBunVersionBelowFloor(version: string | undefined): boolean {
  if (!version) return false;

  const [major, minor] = version.split(".").map((part) => Number.parseInt(part, 10));
  if (!Number.isInteger(major) || !Number.isInteger(minor)) return false;

  const [floorMajor, floorMinor] = MINIMUM_BUN_VERSION;
  return major < floorMajor || (major === floorMajor && minor < floorMinor);
}
