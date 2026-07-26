import assert from "node:assert";
import { test, describe, beforeAll, afterEach, mock, spyOn } from "bun:test";

import sharp from "sharp";

import { generateQuestionImage } from "../lib/image-generator";

describe("generateQuestionImage", () => {
  let pngBuffer: Buffer;

  beforeAll(async () => {
    // Create a minimal valid PNG that sharp can process
    pngBuffer = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
  });

  afterEach(() => {
    mock.restore();
  });

  function makeLogger() {
    return {
      info: mock(),
      error: mock(),
      debug: mock(),
      warn: mock(),
    };
  }

  test("returns empty object for empty message", async () => {
    const result = await generateQuestionImage("", makeLogger());
    assert.deepStrictEqual(result, {});
  });

  test("returns empty object for falsy message", async () => {
    const result = await generateQuestionImage(null as any, makeLogger());
    assert.deepStrictEqual(result, {});
  });

  test("returns image on successful fetch - default theme", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(pngBuffer, { status: 200 })
    );
    const result = await generateQuestionImage("What is your name?", makeLogger());
    assert.ok(result.imageBlob instanceof Buffer);
    assert.ok(typeof result.imageAltText === "string");
    assert.ok(typeof result.width === "number");
    assert.ok(typeof result.height === "number");
  });

  test("returns image with userBskyHandle", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(pngBuffer, { status: 200 })
    );
    const result = await generateQuestionImage("Hello", makeLogger(), "alice.bsky.social");
    assert.ok(result.imageBlob instanceof Buffer);
  });

  test("returns image for compressed theme", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(pngBuffer, { status: 200 })
    );
    const result = await generateQuestionImage("Hello", makeLogger(), undefined, "compressed");
    assert.ok(result.imageBlob instanceof Buffer);
  });

  test("returns image for twitter theme", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(pngBuffer, { status: 200 })
    );
    const result = await generateQuestionImage("Hello", makeLogger(), "alice", "twitter");
    assert.ok(result.imageBlob instanceof Buffer);
  });

  test("returns empty object on HTTP 4xx response", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("bad request", { status: 400 })
    );
    const result = await generateQuestionImage("Hello", makeLogger());
    assert.deepStrictEqual(result, {});
  });

  test("returns empty object on HTTP 5xx response", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("server error", { status: 500 })
    );
    const result = await generateQuestionImage("Hello", makeLogger());
    assert.deepStrictEqual(result, {});
  });
});
