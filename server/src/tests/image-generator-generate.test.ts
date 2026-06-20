import assert from "node:assert";
import { test, describe, mock, before, afterEach } from "node:test";

import sharp from "sharp";

import { generateQuestionImage } from "../lib/image-generator";

describe("generateQuestionImage", () => {
  let pngBuffer: Buffer;

  before(async () => {
    // Create a minimal valid PNG that sharp can process
    pngBuffer = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
  });

  afterEach(() => {
    mock.restoreAll();
    try {
      mock.timers.reset();
    } catch {
      /* not enabled */
    }
  });

  function makeLogger() {
    return {
      info: mock.fn(),
      error: mock.fn(),
      debug: mock.fn(),
      warn: mock.fn(),
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
    mock.method(globalThis, "fetch", async () => new Response(pngBuffer, { status: 200 }));
    const result = await generateQuestionImage("What is your name?", makeLogger());
    assert.ok(result.imageBlob instanceof Buffer);
    assert.ok(typeof result.imageAltText === "string");
    assert.ok(typeof result.width === "number");
    assert.ok(typeof result.height === "number");
  });

  test("returns image with userBskyHandle", async () => {
    mock.method(globalThis, "fetch", async () => new Response(pngBuffer, { status: 200 }));
    const result = await generateQuestionImage("Hello", makeLogger(), "alice.bsky.social");
    assert.ok(result.imageBlob instanceof Buffer);
  });

  test("returns image for compressed theme", async () => {
    mock.method(globalThis, "fetch", async () => new Response(pngBuffer, { status: 200 }));
    const result = await generateQuestionImage("Hello", makeLogger(), undefined, "compressed");
    assert.ok(result.imageBlob instanceof Buffer);
  });

  test("returns image for twitter theme", async () => {
    mock.method(globalThis, "fetch", async () => new Response(pngBuffer, { status: 200 }));
    const result = await generateQuestionImage("Hello", makeLogger(), "alice", "twitter");
    assert.ok(result.imageBlob instanceof Buffer);
  });

  test("returns empty object on HTTP 4xx response", async () => {
    mock.method(globalThis, "fetch", async () => new Response("bad request", { status: 400 }));
    const result = await generateQuestionImage("Hello", makeLogger());
    assert.deepStrictEqual(result, {});
  });

  test("returns empty object on HTTP 5xx response", async () => {
    mock.method(globalThis, "fetch", async () => new Response("server error", { status: 500 }));
    const result = await generateQuestionImage("Hello", makeLogger());
    assert.deepStrictEqual(result, {});
  });
});
