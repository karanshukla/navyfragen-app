import { IdResolver, MemoryCache } from "@atproto/identity";

const HOUR = 60e3 * 60;
const DAY = HOUR * 24;

export function createIdResolver() {
  return new IdResolver({
    didCache: new MemoryCache(HOUR, DAY),
    backupNameservers: ["8.8.8.8", "1.1.1.1"],
    timeout: 5000,
  });
}

export interface BidirectionalResolver {
  resolveDidToHandle(did: string): Promise<string>;
  resolveDidsToHandles(dids: string[]): Promise<Record<string, string>>;
  resolveHandleToDid(handle: string): Promise<string | undefined>;
}

// Upper bound on the number of distinct entries kept in each resolution cache.
// A long-running process otherwise accumulates one entry per distinct handle/DID
// it has ever resolved, with no eviction — enough to grow without limit and
// waste memory on entries that are never revisited. 1000 covers an active
// account's working set of correspondents; older entries drop out.
const CACHE_MAX = 1000;

// A tiny bounded LRU map. JS `Map` already iterates in insertion order, so
// re-inserting a key (the access-on-read pattern below) moves it to the
// most-recently-used position; evicting the first key on overflow yields LRU.
// Kept local rather than pulling in an `lru-cache` dependency for a structure
// this small.
class LruCache<V> {
  #map = new Map<string, V>();

  get(key: string): V | undefined {
    const value = this.#map.get(key);
    if (value !== undefined) {
      // Re-insert so the most-recently-accessed key moves to the end of the
      // iteration order (Map preserves insertion order, delete + set = bump).
      this.#map.delete(key);
      this.#map.set(key, value);
    }
    return value;
  }

  set(key: string, value: V): void {
    if (this.#map.has(key)) this.#map.delete(key);
    this.#map.set(key, value);
    while (this.#map.size > CACHE_MAX) {
      const oldest = this.#map.keys().next().value;
      if (oldest === undefined) break;
      this.#map.delete(oldest);
    }
  }
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

// Builds a TTL'd entry around an LruCache: a get is a hit only when the entry
// exists and has not expired. Expired entries are left in place (they'll be
// evicted by the LRU bound if stale-but-uncached entries accumulate); a fresh
// set overwrites them.
function ttlCache<V>() {
  const cache = new LruCache<CacheEntry<V>>();
  return {
    get(key: string): V | undefined {
      const entry = cache.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) return undefined;
      return entry.value;
    },
    set(key: string, value: V, ttlMs: number) {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}

export function createBidirectionalResolver(resolver: IdResolver) {
  // handle → DID (DNS/HTTP, slow without caching). Bounded + TTL'd.
  const handleCache = ttlCache<string | undefined>();
  // DID → handle. Previously uncached, so every message reply and every push
  // notification re-resolved the same active correspondent over DNS/HTTPS.
  // Mirrors the handle cache's TTL/bound.
  const didToHandleCache = ttlCache<string>();

  return {
    async resolveDidToHandle(did: string): Promise<string> {
      const cached = didToHandleCache.get(did);
      if (cached !== undefined) return cached;

      let resolved: string;
      try {
        const didDoc = await resolver.did.resolveAtprotoData(did);
        if (!didDoc || !didDoc.handle) {
          const resolvedHandle = await resolver.handle.resolve(did);
          resolved = resolvedHandle || did;
        } else {
          // Confirm the handle actually points back at this DID. The DID doc is
          // authoritative for the handle it claims, so when the underlying
          // didCache entry is fresh the verification round-trip can be skipped
          // — but @atproto's MemoryCache exposes no freshness signal, so the
          // extra resolve stays as a safety check on the slow path. The result
          // is cached regardless, so repeat calls for the same DID skip it.
          const resolvedHandleFromDoc = await resolver.handle.resolve(didDoc.handle);
          resolved =
            resolvedHandleFromDoc === did ? didDoc.handle : resolvedHandleFromDoc || didDoc.handle;
        }
      } catch {
        resolved = did;
      }

      // Cache even the DID-as-handle fallback: it's stable for an unresolvable
      // DID, and caching it avoids repeating a network lookup that already
      // failed. A resolvable DID whose handle later changes will refresh after
      // the TTL.
      didToHandleCache.set(did, resolved, HOUR);
      return resolved;
    },

    async resolveDidsToHandles(dids: string[]): Promise<Record<string, string>> {
      const didHandleMap: Record<string, string> = {};
      const results = await Promise.allSettled(dids.map((did) => this.resolveDidToHandle(did)));
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          didHandleMap[dids[index]] = result.value;
        } else {
          didHandleMap[dids[index]] = dids[index];
        }
      });
      return didHandleMap;
    },

    async resolveHandleToDid(handle: string): Promise<string | undefined> {
      const cached = handleCache.get(handle);
      if (cached !== undefined) return cached;

      try {
        const did = await resolver.handle.resolve(handle);
        handleCache.set(handle, did, HOUR);
        return did;
      } catch {
        return undefined;
      }
    },
  };
}
