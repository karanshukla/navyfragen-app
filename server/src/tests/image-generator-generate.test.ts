import assert from "node:assert";
import { test, describe, beforeAll, afterEach, mock } from "bun:test";

import sharp from "sharp";

import { generateQuestionImage } from "../lib/image-generator";

import { bodyBytes, mockFetch, mockLogger } from "./helpers/mocks";

const smallestPngSharpAccepts = () =>
  sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();

describe("generateQuestionImage", () => {
  let pngBuffer: Buffer;

  beforeAll(async () => {
    pngBuffer = await smallestPngSharpAccepts();
  });

  afterEach(() => {
    mock.restore();
  });

  test("returns empty object for empty message", async () => {
    const result = await generateQuestionImage("", mockLogger());
    assert.deepStrictEqual(result, {});
  });

  test("returns empty object for falsy message", async () => {
    const result = await generateQuestionImage(null as any, mockLogger());
    assert.deepStrictEqual(result, {});
  });

  test("returns image on successful fetch - default theme", async () => {
    mockFetch(async () => new Response(bodyBytes(pngBuffer), { status: 200 }));
    const result = await generateQuestionImage("What is your name?", mockLogger());
    assert.ok(result.imageBlob instanceof Buffer);
    assert.ok(typeof result.imageAltText === "string");
    assert.ok(typeof result.width === "number");
    assert.ok(typeof result.height === "number");
  });

  test("returns image with userBskyHandle", async () => {
    mockFetch(async () => new Response(bodyBytes(pngBuffer), { status: 200 }));
    const result = await generateQuestionImage("Hello", mockLogger(), "alice.bsky.social");
    assert.ok(result.imageBlob instanceof Buffer);
  });

  test("returns image for compressed theme", async () => {
    mockFetch(async () => new Response(bodyBytes(pngBuffer), { status: 200 }));
    const result = await generateQuestionImage("Hello", mockLogger(), undefined, "compressed");
    assert.ok(result.imageBlob instanceof Buffer);
  });

  test("returns image for twitter theme", async () => {
    mockFetch(async () => new Response(bodyBytes(pngBuffer), { status: 200 }));
    const result = await generateQuestionImage("Hello", mockLogger(), "alice", "twitter");
    assert.ok(result.imageBlob instanceof Buffer);
  });

  test("returns empty object on HTTP 4xx response", async () => {
    mockFetch(async () => new Response("bad request", { status: 400 }));
    const result = await generateQuestionImage("Hello", mockLogger());
    assert.deepStrictEqual(result, {});
  });

  test("returns empty object on HTTP 5xx response", async () => {
    mockFetch(async () => new Response("server error", { status: 500 }));
    const result = await generateQuestionImage("Hello", mockLogger());
    assert.deepStrictEqual(result, {});
  });

  test("returns empty object when image processing throws", async () => {
    mockFetch(async () => new Response(bodyBytes(Buffer.from("not a real png")), { status: 200 }));
    const logger = mockLogger();
    const result = await generateQuestionImage("Hello", logger);
    assert.deepStrictEqual(result, {});
    assert.strictEqual(logger.error.mock.calls.length, 1);
    assert.strictEqual(logger.error.mock.calls[0][1], "Error during image generation process");
  });
});
