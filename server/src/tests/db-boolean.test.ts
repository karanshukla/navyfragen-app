import assert from "node:assert";
import { test, describe } from "bun:test";

import { fromDbBoolean, toDbBoolean } from "../lib/db-boolean";

describe("fromDbBoolean", () => {
  test("reads SQLite 0/1 integers", () => {
    assert.strictEqual(fromDbBoolean(1, true), true);
    assert.strictEqual(fromDbBoolean(0, true), false);
  });

  test("reads Postgres native booleans", () => {
    assert.strictEqual(fromDbBoolean(true, false), true);
    assert.strictEqual(fromDbBoolean(false, true), false);
  });

  test("falls back to the column default when the value is absent", () => {
    assert.strictEqual(fromDbBoolean(undefined, true), true);
    assert.strictEqual(fromDbBoolean(null, true), true);
    assert.strictEqual(fromDbBoolean(undefined, false), false);
    assert.strictEqual(fromDbBoolean(null, false), false);
  });
});

describe("toDbBoolean", () => {
  test("writes SQLite-compatible 0/1 integers", () => {
    assert.strictEqual(toDbBoolean(true), 1);
    assert.strictEqual(toDbBoolean(false), 0);
  });
});
