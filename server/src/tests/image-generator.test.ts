import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import { fetchWithRetry } from "../lib/image-generator";

describe("fetchWithRetry", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test("returns response immediately on first successful attempt", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    mock.method(globalThis, "fetch", async () => mockResponse);

    const result = await fetchWithRetry("http://test/", {}, 5000);

    assert.strictEqual(result, mockResponse);
    assert.strictEqual((globalThis.fetch as any).mock.calls.length, 1);
  });

  test("retries on network error and returns response when service comes up", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    let callCount = 0;
    mock.method(globalThis, "fetch", async () => {
      callCount++;
      if (callCount < 3) throw new Error("ECONNREFUSED");
      return mockResponse;
    });

    const result = await fetchWithRetry("http://test/", {}, 5000);

    assert.strictEqual(result, mockResponse);
    assert.strictEqual(callCount, 3);
  });

  test("throws the last network error after timeout is exhausted", async () => {
    const networkError = new Error("connect ECONNREFUSED 127.0.0.1:3033");
    mock.method(globalThis, "fetch", async () => {
      throw networkError;
    });

    await assert.rejects(
      () => fetchWithRetry("http://test/", {}, 50),
      networkError
    );
  });

  test("does not retry on HTTP error responses", async () => {
    let callCount = 0;
    mock.method(globalThis, "fetch", async () => {
      callCount++;
      return new Response("internal error", { status: 500 });
    });

    const result = await fetchWithRetry("http://test/", {}, 5000);

    assert.strictEqual(result.status, 500);
    assert.strictEqual(callCount, 1);
  });

  test("passes url and init options through to fetch, adding an AbortSignal", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    const capturedArgs: any[] = [];
    mock.method(globalThis, "fetch", async (...args: any[]) => {
      capturedArgs.push(args);
      return mockResponse;
    });

    const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" };
    await fetchWithRetry("http://test/endpoint", init, 5000);

    assert.strictEqual(capturedArgs[0][0], "http://test/endpoint");
    const passedInit = capturedArgs[0][1];
    assert.strictEqual(passedInit.method, init.method);
    assert.deepStrictEqual(passedInit.headers, init.headers);
    assert.strictEqual(passedInit.body, init.body);
    assert.ok(passedInit.signal instanceof AbortSignal, "Should include an AbortSignal");
  });
});
