interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * `Map` iterates in insertion order, so deleting and re-inserting on read bumps
 * a key to the most-recently-used position and evicting the first key yields
 * LRU. Local rather than an `lru-cache` dependency for a structure this small.
 */
class LruMap<V> {
  #entries = new Map<string, V>();

  constructor(private maxEntries: number) {}

  get(key: string): V | undefined {
    const value = this.#entries.get(key);
    if (value !== undefined) {
      this.#entries.delete(key);
      this.#entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: V): void {
    if (this.#entries.has(key)) this.#entries.delete(key);
    this.#entries.set(key, value);
    while (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  delete(key: string): void {
    this.#entries.delete(key);
  }

  get size(): number {
    return this.#entries.size;
  }
}

export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V, ttlMs: number): void;
  /**
   * Reads and removes in one synchronous step, so concurrent callers cannot
   * both observe the same entry. The render store relies on that to make a
   * ready render single-use.
   */
  take(key: string): V | undefined;
  readonly size: number;
}

/**
 * Bounded so a long-running process cannot accumulate one entry per distinct
 * key it has ever seen. Expired entries are left in place for the LRU bound to
 * evict; a fresh `set` overwrites them.
 *
 * @see [ttl-cache.test.ts](../tests/ttl-cache.test.ts) — pins expiry, the
 * eviction order, and the bound.
 */
export function createTtlCache<V>(maxEntries: number): TtlCache<V> {
  const cache = new LruMap<CacheEntry<V>>(maxEntries);

  const read = (key: string): V | undefined => {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) return undefined;
    return entry.value;
  };

  return {
    get: read,
    set(key: string, value: V, ttlMs: number): void {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    take(key: string): V | undefined {
      const value = read(key);
      cache.delete(key);
      return value;
    },
    get size() {
      return cache.size;
    },
  };
}
