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

  test("returns the pt catalog for 'pt'", () => {
    const messages = getServerMessages("pt");
    assert.strictEqual(messages.push.titleAnonymous, "Nova pergunta anônima");
    assert.strictEqual(messages.push.titleForHandle("alice"), "Nova pergunta para @alice");
    assert.strictEqual(messages.push.body, `Alguém te enviou uma pergunta anônima no ${APP_NAME}!`);
    assert.strictEqual(messages.exampleQuestions.length, 8);
  });

  test("does not fall back to en for 'pt'", () => {
    assert.notDeepStrictEqual(getServerMessages("pt"), getServerMessages("en"));
  });

  test("falls back to en for a related-but-unrecognized locale tag like 'pt-BR'", () => {
    assert.deepStrictEqual(getServerMessages("pt-BR"), getServerMessages("en"));
  });

  test("returns the de catalog for 'de'", () => {
    const messages = getServerMessages("de");
    assert.strictEqual(messages.push.titleAnonymous, "Neue anonyme Frage");
    assert.strictEqual(messages.push.titleForHandle("alice"), "Neue Frage für @alice");
    assert.strictEqual(
      messages.push.body,
      `Jemand hat dir eine anonyme Frage auf ${APP_NAME} geschickt!`
    );
    assert.strictEqual(messages.exampleQuestions.length, 8);
  });

  test("does not fall back to en for 'de'", () => {
    assert.notDeepStrictEqual(getServerMessages("de"), getServerMessages("en"));
  });

  test("falls back to en for a related-but-unrecognized locale tag like 'de-AT'", () => {
    assert.deepStrictEqual(getServerMessages("de-AT"), getServerMessages("en"));
  });

  test("returns the fr catalog for 'fr'", () => {
    const messages = getServerMessages("fr");
    assert.strictEqual(messages.push.titleAnonymous, "Nouvelle question anonyme");
    assert.strictEqual(messages.push.titleForHandle("alice"), "Nouvelle question pour @alice");
    assert.strictEqual(
      messages.push.body,
      `Quelqu'un t'a envoyé une question anonyme sur ${APP_NAME} !`
    );
    assert.strictEqual(messages.exampleQuestions.length, 8);
  });

  test("does not fall back to en for 'fr'", () => {
    assert.notDeepStrictEqual(getServerMessages("fr"), getServerMessages("en"));
  });

  test("falls back to en for a related-but-unrecognized locale tag like 'fr-CA'", () => {
    assert.deepStrictEqual(getServerMessages("fr-CA"), getServerMessages("en"));
  });
});
