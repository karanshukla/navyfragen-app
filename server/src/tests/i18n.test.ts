import assert from "node:assert";
import { test, describe } from "bun:test";

import { getServerMessages, type ServerMessages } from "../lib/i18n";
import { APP_NAME } from "../lib/brand";

describe("getServerMessages", () => {
  test("returns the en catalog for 'en'", () => {
    const messages = getServerMessages("en");
    assert.strictEqual(messages.push.titleAnonymous, "New anonymous question");
    assert.strictEqual(messages.push.titleForHandle("alice"), "New question for @alice");
    assert.strictEqual(
      messages.push.body,
      `Someone sent you an anonymous question on ${APP_NAME}!`
    );
    assert.strictEqual(messages.exampleQuestions.length, 8);
  });

  test("falls back to en when the locale is null", () => {
    assert.deepStrictEqual(getServerMessages(null), getServerMessages("en"));
  });

  test("falls back to en when the locale is undefined", () => {
    assert.deepStrictEqual(getServerMessages(undefined), getServerMessages("en"));
  });

  test("falls back to en for an unrecognized locale string", () => {
    assert.deepStrictEqual(getServerMessages("xx"), getServerMessages("en"));
  });

  test("falls back to en for an empty string", () => {
    assert.deepStrictEqual(getServerMessages(""), getServerMessages("en"));
  });

  test("satisfies the ServerMessages shape", () => {
    const messages: ServerMessages = getServerMessages("en");
    assert.strictEqual(typeof messages.push.titleForHandle, "function");
    assert.strictEqual(typeof messages.push.titleAnonymous, "string");
    assert.strictEqual(typeof messages.push.body, "string");
    assert.ok(Array.isArray(messages.exampleQuestions));
  });

  test("returns the es catalog for 'es'", () => {
    const messages = getServerMessages("es");
    assert.strictEqual(messages.push.titleAnonymous, "Nueva pregunta anónima");
    assert.strictEqual(messages.push.titleForHandle("alice"), "Nueva pregunta para @alice");
    assert.strictEqual(
      messages.push.body,
      `¡Alguien te envió una pregunta anónima en ${APP_NAME}!`
    );
    assert.strictEqual(messages.exampleQuestions.length, 8);
  });

  test("does not fall back to en for 'es'", () => {
    assert.notDeepStrictEqual(getServerMessages("es"), getServerMessages("en"));
  });

  test("falls back to en for a related-but-unrecognized locale tag like 'es-MX'", () => {
    assert.deepStrictEqual(getServerMessages("es-MX"), getServerMessages("en"));
  });
});
