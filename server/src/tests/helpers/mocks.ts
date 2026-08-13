// Casts that only tests need, kept in one place so no test file has to reach
// for `as any` to satisfy a runtime-only mismatch.

import { mock, spyOn } from "bun:test";

import type { Logger } from "pino";

/**
 * Replaces `globalThis.fetch` for the duration of a test.
 *
 * Bun types the global as a callable object carrying `preconnect`, so a plain
 * async function is not assignable to it even though nothing under test calls
 * anything but the call signature.
 */
export function mockFetch(impl: (...args: Parameters<typeof fetch>) => Promise<Response>) {
  return spyOn(globalThis, "fetch").mockImplementation(impl as unknown as typeof fetch);
}

/**
 * A `Logger` whose four used levels are spies. Pino's interface carries a dozen
 * members no code path under test touches, so the object is narrowed to the
 * levels that are actually asserted on.
 */
export function mockLogger() {
  const spies = { info: mock(), error: mock(), debug: mock(), warn: mock() };
  return spies as unknown as Logger & typeof spies;
}

/**
 * Body bytes as a `Response` accepts them. `Buffer` is a `Uint8Array` at
 * runtime, but neither its Node typing nor a view over a `SharedArrayBuffer`
 * satisfies `BodyInit`.
 */
export function bodyBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return bytes;
}
