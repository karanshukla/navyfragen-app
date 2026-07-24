// Bun-only test preload.
//
// Under the Bun runtime, importing "@atproto/oauth-client-node" (which
// `src/services/auth-service.ts` does for `OAuthResolverError`) transitively
// loads `@atproto-labs/fetch-node/dist/unicast.js`, whose top-level
// `import { Agent } from "undici_v8"` evaluates undici 8.7.0's `CacheStorage`
// constructor — and that throws `webidl.util.markAsUncloneable is not a function`
// under Bun 1.3.x. This is a runtime incompatibility, not a test/mock concern.
//
// To run the auth tests under Bun, we stub `@atproto-labs/fetch-node` (the
// nearest seam) before any test module imports it, so `undici_v8` is never
// loaded. The stub is a passthrough to `globalThis.fetch` — the tests don't
// exercise unicast SSRF protection; they mock the agent/session seam directly.
//
// Loaded ONLY via `bun test --preload ./src/tests/mock-bun-preload.js`. Node
// ignores this file (the Node test scripts don't reference it). Tracked by
// #269; see docs/testing-notes.md.
import { mock } from "bun:test";

// Passthrough fetch helpers — tests mock the atproto agent/session layer, not
// the SSRF-safe fetch wrapper, so a plain passthrough is sufficient here.
mock.module("@atproto-labs/fetch-node", () => ({
  safeFetchWrap: ({ fetch = globalThis.fetch } = {}) => fetch,
  unicastFetchWrap: ({ fetch = globalThis.fetch } = {}) => fetch,
  isUnicastIpHostname: () => true,
  // Mirror the deprecated alias the barrel re-exports.
  isUnicastIp: () => true,
}));
