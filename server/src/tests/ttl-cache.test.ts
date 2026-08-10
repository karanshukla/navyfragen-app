import assert from "node:assert";
import { test, describe } from "bun:test";

import { createTtlCache } from "../lib/ttl-cache";

const ONE_MINUTE = 60_000;

describe("createTtlCache", () => {
  test("returns a stored value before its TTL elapses", () => {
    const cache = createTtlCache<string>(10);
    cache.set("a", "value", ONE_MINUTE);
    assert.strictEqual(cache.get("a"), "value");
  });

  test("misses on an unknown key", () => {
    const cache = createTtlCache<string>(10);
    assert.strictEqual(cache.get("missing"), undefined);
  });

  test("misses once the entry has expired", () => {
    const cache = createTtlCache<string>(10);
    cache.set("a", "value", -1);
    assert.strictEqual(cache.get("a"), undefined);
  });

  test("a fresh set revives an expired key", () => {
    const cache = createTtlCache<string>(10);
    cache.set("a", "stale", -1);
    cache.set("a", "fresh", ONE_MINUTE);
    assert.strictEqual(cache.get("a"), "fresh");
  });

  test("never grows past maxEntries", () => {
    const cache = createTtlCache<number>(3);
    for (let i = 0; i < 10; i++) cache.set(`key-${i}`, i, ONE_MINUTE);
    assert.strictEqual(cache.size, 3);
  });

  test("evicts the least recently used key first", () => {
    const cache = createTtlCache<number>(2);
    cache.set("a", 1, ONE_MINUTE);
    cache.set("b", 2, ONE_MINUTE);

    cache.get("a");
    cache.set("c", 3, ONE_MINUTE);

    assert.strictEqual(cache.get("b"), undefined);
    assert.strictEqual(cache.get("a"), 1);
    assert.strictEqual(cache.get("c"), 3);
  });

  test("overwriting a key does not consume an extra slot", () => {
    const cache = createTtlCache<number>(2);
    cache.set("a", 1, ONE_MINUTE);
    cache.set("a", 2, ONE_MINUTE);
    cache.set("b", 3, ONE_MINUTE);

    assert.strictEqual(cache.size, 2);
    assert.strictEqual(cache.get("a"), 2);
    assert.strictEqual(cache.get("b"), 3);
  });
});
