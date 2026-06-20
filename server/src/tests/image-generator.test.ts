import assert from "node:assert";
import { test, describe, mock, afterEach } from "node:test";

import {
  fetchWithRetry,
  wrapLines,
  msgFontSize,
  generateThemeSpecificHtml,
} from "../lib/image-generator";

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

    await assert.rejects(() => fetchWithRetry("http://test/", {}, 50), networkError);
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

  test("breaks without sleeping when deadline expires during a failed fetch attempt", async () => {
    let fetchCallCount = 0;
    mock.method(globalThis, "fetch", async () => {
      fetchCallCount++;
      // Simulate a fetch that takes 50ms — longer than the 10ms overall timeout
      await new Promise((r) => setTimeout(r, 50));
      throw new Error("slow connect error");
    });

    await assert.rejects(
      () => fetchWithRetry("http://test/", {}, 10),
      (err: unknown) => err instanceof Error && err.message === "slow connect error"
    );

    // Only one fetch attempt: deadline passed during the request, so the
    // `if (remainingAfter <= 0) break` path exits without a retry sleep.
    assert.strictEqual(fetchCallCount, 1);
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

describe("msgFontSize", () => {
  test("returns large when length <= 60", () => {
    assert.strictEqual(msgFontSize(30, 26, 21, 17), 26);
    assert.strictEqual(msgFontSize(60, 26, 21, 17), 26);
  });

  test("returns medium when length 61-120", () => {
    assert.strictEqual(msgFontSize(61, 26, 21, 17), 21);
    assert.strictEqual(msgFontSize(120, 26, 21, 17), 21);
  });

  test("returns small when length > 120", () => {
    assert.strictEqual(msgFontSize(121, 26, 21, 17), 17);
    assert.strictEqual(msgFontSize(300, 26, 21, 17), 17);
  });
});

describe("wrapLines", () => {
  // charsPerLine = areaWidth / (fontSize * charWidthCoeff) = 100 / (10 * 1.0) = 10

  test("returns 1 for a single short word", () => {
    assert.strictEqual(wrapLines("hello", 10, 100, 1.0), 1);
  });

  test("word fits on existing line (lineChars + 1 + word <= charsPerLine)", () => {
    // "ab cd" => "ab"(2) + space + "cd"(2) = 5 <= 10, fits on one line
    assert.strictEqual(wrapLines("ab cd", 10, 100, 1.0), 1);
  });

  test("word wraps to new line when combined length exceeds charsPerLine", () => {
    // "hello world" => "hello"(5), then 5+1+5=11 > 10, wraps -> 2 lines
    assert.strictEqual(wrapLines("hello world", 10, 100, 1.0), 2);
  });

  test("empty paragraph (blank line in text) counts as a line", () => {
    // "hello\n\nworld" => ["hello", "", "world"] => 1 + 1 (empty) + 1 = 3
    assert.strictEqual(wrapLines("hello\n\nworld", 10, 100, 1.0), 3);
  });

  test("long word on a fresh line (lineChars === 0)", () => {
    // 21-char word, charsPerLine=10: ceil(21/10)-1=2 extra lines, lineChars = 21%10 = 1
    // total pLines = 1 + 2 = 3
    assert.strictEqual(wrapLines("abcdefghijklmnopqrstu", 10, 100, 1.0), 3);
  });

  test("long word when lineChars > 0 triggers extra line break", () => {
    // "hi abcdefghijklmnopqrstu": "hi"(2) then 21-char word with lineChars=2 > 0 -> pLines++
    // pLines = 1 -> "hi" sets lineChars=2 -> 21-char word: pLines++(2), pLines+=2(4), lineChars=1
    assert.strictEqual(wrapLines("hi abcdefghijklmnopqrstu", 10, 100, 1.0), 4);
  });

  test("word length exact multiple of charsPerLine uses || charsPerLine branch", () => {
    // 20-char word, charsPerLine=10: 20%10 = 0, so lineChars = 0 || 10 = 10
    // ceil(20/10)-1 = 1 extra line, pLines = 1+1 = 2
    assert.strictEqual(wrapLines("abcdefghijabcdefghij", 10, 100, 1.0), 2);
  });

  test("returns at least 1 for empty string", () => {
    assert.strictEqual(wrapLines("", 10, 100, 1.0), 1);
  });

  test("emoji characters count as 1 not 2 (surrogate pair fix)", () => {
    // "hi 👋" => "hi"(2) + space + "👋"(1 code point) = 4 total, fits on one line of 10
    assert.strictEqual(wrapLines("hi 👋", 10, 100, 1.0), 1);
    // 10 emojis => 10 code points, exactly fills one line
    assert.strictEqual(wrapLines("😀😀😀😀😀😀😀😀😀😀", 10, 100, 1.0), 1);
    // 11 emojis => wraps to 2 lines
    assert.strictEqual(wrapLines("😀😀😀😀😀😀😀😀😀😀😀", 10, 100, 1.0), 2);
  });
});

describe("generateThemeSpecificHtml", () => {
  test("default theme returns correct html with width 360", () => {
    const result = generateThemeSpecificHtml("default", "hello", "navyfragen.app", "hello");
    assert.strictEqual(result.width, 360);
    assert.ok(result.html.includes("hello"));
    assert.ok(result.height > 0);
  });

  test("compressed theme returns correct html with width 380", () => {
    const result = generateThemeSpecificHtml("compressed", "hello", "navyfragen.app", "hello");
    assert.strictEqual(result.width, 380);
    assert.ok(result.html.includes("hello"));
  });

  test("twitter theme returns correct html with width 420", () => {
    const result = generateThemeSpecificHtml("twitter", "hello", "navyfragen.app", "hello");
    assert.strictEqual(result.width, 420);
    assert.ok(result.html.includes("hello"));
  });

  test("unknown theme falls back to default (width 360)", () => {
    const result = generateThemeSpecificHtml("neon", "hello", "navyfragen.app", "hello");
    assert.strictEqual(result.width, 360);
  });

  test("twitter theme with handle includes mention", () => {
    const result = generateThemeSpecificHtml(
      "twitter",
      "hello",
      "fragen.navy/myhandle",
      "hello",
      "myhandle"
    );
    assert.ok(result.html.includes("@myhandle"));
  });

  test("emoji message produces same height as equal-length ascii message", () => {
    // 5 emojis == 5 visible characters; should produce same layout as 5 ascii chars
    const emojiResult = generateThemeSpecificHtml(
      "default",
      "👋👋👋👋👋",
      "navyfragen.app",
      "👋👋👋👋👋"
    );
    const asciiResult = generateThemeSpecificHtml("default", "hello", "navyfragen.app", "hello");
    assert.strictEqual(emojiResult.height, asciiResult.height);
  });
});
