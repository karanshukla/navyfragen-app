/* v8 ignore start */
import assert from "node:assert";
import { test, describe } from "node:test";

import { errorMessage } from "../lib/errors";
/* v8 ignore stop */

describe("errorMessage", () => {
  test("extracts .message from an Error", () => {
    assert.strictEqual(errorMessage(new Error("boom")), "boom");
  });

  test("extracts .message from an Error subclass", () => {
    assert.strictEqual(errorMessage(new TypeError("bad type")), "bad type");
  });

  test("extracts .message from a plain object with a string message", () => {
    assert.strictEqual(errorMessage({ message: "object error" }), "object error");
  });

  test("returns empty string when object .message is not a string", () => {
    assert.strictEqual(errorMessage({ message: 42 }), "");
  });

  test("returns empty string for a plain string throw (fallback path)", () => {
    assert.strictEqual(errorMessage("non-Error string"), "");
  });

  test("returns empty string for other primitives", () => {
    assert.strictEqual(errorMessage(null), "");
    assert.strictEqual(errorMessage(undefined), "");
    assert.strictEqual(errorMessage(123), "");
  });
});
