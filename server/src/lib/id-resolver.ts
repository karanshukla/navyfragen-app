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

export function createBidirectionalResolver(resolver: IdResolver) {
  // Cache handle → DID lookups (DNS/HTTP, so inherently slow without caching)
  const handleCache = new Map<string, { did: string | undefined; expiresAt: number }>();

  return {
    async resolveDidToHandle(did: string): Promise<string> {
      try {
        const didDoc = await resolver.did.resolveAtprotoData(did);
        if (!didDoc || !didDoc.handle) {
          const resolvedHandle = await resolver.handle.resolve(did);
          if (resolvedHandle) return resolvedHandle;
          return did;
        }
        const resolvedHandleFromDoc = await resolver.handle.resolve(didDoc.handle);
        if (resolvedHandleFromDoc === did) {
          return didDoc.handle;
        }
        return resolvedHandleFromDoc || didDoc.handle;
      } catch {
        return did;
      }
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
      const now = Date.now();
      const cached = handleCache.get(handle);
      if (cached && cached.expiresAt > now) {
        return cached.did;
      }

      try {
        const did = await resolver.handle.resolve(handle);
        handleCache.set(handle, { did, expiresAt: now + HOUR });
        return did;
      } catch {
        return undefined;
      }
    },
  };
}
