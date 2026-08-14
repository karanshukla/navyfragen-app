import assert from "node:assert";
import { describe, it } from "bun:test";

import { isBunVersionBelowFloor, MINIMUM_BUN_VERSION } from "#/lib/bun-version-floor";

describe("bun version floor", () => {
  it("rejects 1.3.14, the last release without markAsUncloneable", () => {
    assert.strictEqual(isBunVersionBelowFloor("1.3.14"), true);
  });

  it("accepts 1.4.0, the first release with it", () => {
    assert.strictEqual(isBunVersionBelowFloor("1.4.0"), false);
  });

  it("accepts a 1.4 canary build", () => {
    assert.strictEqual(isBunVersionBelowFloor("1.4.0-canary.1"), false);
  });

  it("accepts a later major", () => {
    assert.strictEqual(isBunVersionBelowFloor("2.0.0"), false);
  });

  it("does not block when the runtime is not Bun", () => {
    assert.strictEqual(isBunVersionBelowFloor(undefined), false);
  });

  it("does not block on an unparseable version", () => {
    assert.strictEqual(isBunVersionBelowFloor("not-a-version"), false);
  });

  it("pins the floor at 1.4", () => {
    assert.deepStrictEqual([...MINIMUM_BUN_VERSION], [1, 4]);
  });
});
