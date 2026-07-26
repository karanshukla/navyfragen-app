import assert from "node:assert";
import { describe, test } from "bun:test";

import { containsProfanity } from "../lib/profanity";

describe("containsProfanity", () => {
  test("returns false for empty text", () => {
    assert.strictEqual(containsProfanity(""), false);
  });

  test("returns false for clean text", () => {
    assert.strictEqual(containsProfanity("hello, how are you today?"), false);
  });

  test("returns true for text containing blacklisted profanity", () => {
    assert.strictEqual(containsProfanity("you are a fucking idiot"), true);
  });
});
