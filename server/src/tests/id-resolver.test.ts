import assert from "node:assert";
import { describe, test, beforeEach, mock } from "bun:test";

import { createBidirectionalResolver } from "../lib/id-resolver";

// Minimal stub of the slice of @atproto/identity's IdResolver that the
// bidirectional wrapper touches: did.resolveAtprotoData and handle.resolve.
// Each call is recorded so tests can assert network-call counts directly —
// the acceptance criterion for #318 is "repeat resolveDidToHandle(sameDid)
// within TTL makes zero network calls".
//
// The stub derives the handle/DID pair from its input so distinct DIDs resolve
// to distinct handles (a real resolver does; a constant handle would make
// every DID collide). did:web:X.test ↔ handle X.test, and handle.resolve
// round-trips the handle back to its owning DID.
function makeResolverStub() {
  const didResolveAtprotoData = mock(async (did: string) => ({
    did,
    // did:web:alice.test → handle alice.test
    handle: did.replace(/^did:web:/, ""),
  }));
  const handleResolve = mock(async (handle: string) => `did:web:${handle}`);
  return {
    did: { resolveAtprotoData: didResolveAtprotoData },
    handle: { resolve: handleResolve },
    // Raw references to the underlying mocks so call counts are assertable.
    _didResolveAtprotoData: didResolveAtprotoData,
    _handleResolve: handleResolve,
  };
}

describe("createBidirectionalResolver", () => {
  describe("resolveDidToHandle (DID → handle cache — #318)", () => {
    test("caches: a repeat call within TTL makes zero network calls", async () => {
      const resolver = makeResolverStub();
      const bidi = createBidirectionalResolver(resolver as any);

      const first = await bidi.resolveDidToHandle("did:web:alice.test");
      assert.strictEqual(first, "alice.test");

      const firstNetworkCalls =
        resolver._didResolveAtprotoData.mock.calls.length +
        resolver._handleResolve.mock.calls.length;

      // Second call for the same DID — must be served entirely from cache.
      const second = await bidi.resolveDidToHandle("did:web:alice.test");
      assert.strictEqual(second, "alice.test");

      const secondNetworkCalls =
        resolver._didResolveAtprotoData.mock.calls.length +
        resolver._handleResolve.mock.calls.length;

      assert.strictEqual(
        secondNetworkCalls,
        firstNetworkCalls,
        "second resolveDidToHandle made additional network calls — cache miss"
      );
    });

    test("a distinct DID is a cache miss and does resolve over the network", async () => {
      const resolver = makeResolverStub();
      const bidi = createBidirectionalResolver(resolver as any);

      await bidi.resolveDidToHandle("did:web:alice.test");
      const callsBefore = resolver._didResolveAtprotoData.mock.calls.length;

      await bidi.resolveDidToHandle("did:web:bob.test");
      const callsAfter = resolver._didResolveAtprotoData.mock.calls.length;

      assert.ok(
        callsAfter > callsBefore,
        "a distinct DID should trigger a network resolveAtprotoData call"
      );
    });

    test("returns the DID unchanged when the doc has no handle, and caches that fallback", async () => {
      const resolver = makeResolverStub();
      // No handle on the DID doc; handle.resolve(did) also returns nothing.
      resolver._didResolveAtprotoData.mockImplementation(
        async (did: string) =>
          ({
            did,
            handle: undefined,
          }) as any
      );
      resolver._handleResolve.mockImplementation(async () => undefined as unknown as string);

      const bidi = createBidirectionalResolver(resolver as any);

      const result = await bidi.resolveDidToHandle("did:web:ghost");
      assert.strictEqual(result, "did:web:ghost");

      const callsBefore = resolver._didResolveAtprotoData.mock.calls.length;
      // The fallback is cached too — a repeat makes no network calls.
      await bidi.resolveDidToHandle("did:web:ghost");
      assert.strictEqual(resolver._didResolveAtprotoData.mock.calls.length, callsBefore);
    });

    test("falls back to the DID on resolver failure and caches it", async () => {
      const resolver = makeResolverStub();
      resolver._didResolveAtprotoData.mockImplementation(async () => {
        throw new Error("network down");
      });

      const bidi = createBidirectionalResolver(resolver as any);

      const result = await bidi.resolveDidToHandle("did:web:down");
      assert.strictEqual(result, "did:web:down");

      const callsBefore = resolver._didResolveAtprotoData.mock.calls.length;
      await bidi.resolveDidToHandle("did:web:down");
      assert.strictEqual(resolver._didResolveAtprotoData.mock.calls.length, callsBefore);
    });
  });

  describe("resolveHandleToDid (handle → DID cache)", () => {
    test("caches the resolved DID and serves repeats from cache", async () => {
      const resolver = makeResolverStub();
      const bidi = createBidirectionalResolver(resolver as any);

      const first = await bidi.resolveHandleToDid("alice.test");
      assert.strictEqual(first, "did:web:alice.test");

      const callsBefore = resolver._handleResolve.mock.calls.length;
      const second = await bidi.resolveHandleToDid("alice.test");
      assert.strictEqual(second, "did:web:alice.test");
      assert.strictEqual(
        resolver._handleResolve.mock.calls.length,
        callsBefore,
        "repeat resolveHandleToDid hit the network"
      );
    });

    test("returns undefined (uncached) when the resolver throws", async () => {
      const resolver = makeResolverStub();
      resolver._handleResolve.mockImplementation(async () => {
        throw new Error("dns fail");
      });
      const bidi = createBidirectionalResolver(resolver as any);

      const result = await bidi.resolveHandleToDid("missing.test");
      assert.strictEqual(result, undefined);
    });
  });

  describe("resolveDidsToHandles", () => {
    test("maps each DID to its handle via the cached single-DID path", async () => {
      const resolver = makeResolverStub();
      const bidi = createBidirectionalResolver(resolver as any);

      const result = await bidi.resolveDidsToHandles(["did:web:alice.test", "did:web:bob.test"]);
      assert.strictEqual(result["did:web:alice.test"], "alice.test");
      assert.strictEqual(result["did:web:bob.test"], "bob.test");
    });

    test("falls back to the DID itself when one resolution rejects", async () => {
      const resolver = makeResolverStub();
      // Make alice resolve normally but bob throw.
      resolver._didResolveAtprotoData.mockImplementation(async (did: string) => {
        if (did === "did:web:bob.test") throw new Error("nope");
        return { did, handle: did.replace(/^did:web:/, "") };
      });
      const bidi = createBidirectionalResolver(resolver as any);

      const result = await bidi.resolveDidsToHandles(["did:web:alice.test", "did:web:bob.test"]);
      assert.strictEqual(result["did:web:alice.test"], "alice.test");
      assert.strictEqual(result["did:web:bob.test"], "did:web:bob.test");
    });
  });

  describe("cache bounding (LRU)", () => {
    // The acceptance criterion also asks that both caches have a size bound.
    // We assert it indirectly: insert CACHE_MAX + N distinct keys, then confirm
    // an early-inserted key (evicted by LRU) is a cache miss (re-resolves),
    // while a recently-inserted key is still a hit (no network call).
    test("evicts the least-recently-used DID→handle entry once the cap is exceeded", async () => {
      const resolver = makeResolverStub();
      const bidi = createBidirectionalResolver(resolver as any);

      // Fill the cache past its cap (1000) with distinct DIDs so the
      // earliest-inserted keys are evicted by LRU.
      for (let i = 0; i < 1001; i++) {
        await bidi.resolveDidToHandle(`did:web:${i}.test`);
      }
      // The very first key should have been evicted; re-resolving it must hit
      // the network again.
      const callsBefore = resolver._didResolveAtprotoData.mock.calls.length;
      await bidi.resolveDidToHandle("did:web:0.test");
      assert.ok(
        resolver._didResolveAtprotoData.mock.calls.length > callsBefore,
        "evicted key should re-resolve over the network"
      );

      // The most-recently-inserted key is still cached — no network call.
      const callsBefore2 = resolver._didResolveAtprotoData.mock.calls.length;
      await bidi.resolveDidToHandle("did:web:1000.test");
      assert.strictEqual(
        resolver._didResolveAtprotoData.mock.calls.length,
        callsBefore2,
        "recent key should still be cached"
      );
    });
  });
});
