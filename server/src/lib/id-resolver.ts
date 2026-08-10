import { IdResolver, MemoryCache } from "@atproto/identity";

import { createTtlCache } from "./ttl-cache";

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

// Covers an active account's working set of correspondents.
const CACHE_MAX = 1000;

export function createBidirectionalResolver(resolver: IdResolver) {
  // Both directions hit DNS/HTTPS, and the same correspondent is re-resolved on
  // every message reply and push notification.
  const handleCache = createTtlCache<string | undefined>(CACHE_MAX);
  const didToHandleCache = createTtlCache<string>(CACHE_MAX);

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
          // Confirm the handle points back at this DID. @atproto's MemoryCache
          // exposes no freshness signal, so this verification round-trip can't
          // be skipped on a warm didCache entry; it stays on the slow path only
          // because the result below is cached.
          const resolvedHandleFromDoc = await resolver.handle.resolve(didDoc.handle);
          resolved =
            resolvedHandleFromDoc === did ? didDoc.handle : resolvedHandleFromDoc || didDoc.handle;
        }
      } catch {
        resolved = did;
      }

      // The DID-as-handle fallback is cached too, so a lookup that already
      // failed is not repeated every call.
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
