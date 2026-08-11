import assert from "node:assert";
import { readFileSync } from "node:fs";
import { test, describe, afterEach, mock, spyOn } from "bun:test";

import { imageGenerator } from "#/lib/image-generator";
import { createTtlCache, type TtlCache } from "#/lib/ttl-cache";
import { RenderService, RENDER_TTL_MS } from "#/services/render-service";

const PNG = Buffer.from("fake-png");
const OTHER_DID = "did:plc:someone-else";

/**
 * `enqueue` dispatches the render on the next turn, and the render itself
 * awaits the image service, so a test has to let several turns drain before the
 * store settles.
 */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}

function stubLogger(): any {
  return { info: mock(), error: mock(), warn: mock(), debug: mock() };
}

function stubDb(imageTheme: string | null = null): any {
  return {
    selectFrom: mock(() => ({
      selectAll: mock(function (this: any) {
        return this;
      }),
      where: mock(function (this: any) {
        return this;
      }),
      executeTakeFirst: mock(async () => (imageTheme === null ? undefined : { imageTheme })),
    })),
  };
}

/** Every entry expires the instant it is written. */
function alreadyExpiredStore<V>(): TtlCache<V> {
  const inner = createTtlCache<V>(10);
  return {
    get: (key) => inner.get(key),
    set: (key, value) => inner.set(key, value, -1),
    take: (key) => inner.take(key),
    get size() {
      return inner.size;
    },
  };
}

function recordingStore<V>(): TtlCache<V> & { ttls: number[] } {
  const inner = createTtlCache<V>(10);
  const ttls: number[] = [];
  return {
    ttls,
    get: (key) => inner.get(key),
    set: (key, value, ttlMs) => {
      ttls.push(ttlMs);
      inner.set(key, value, ttlMs);
    },
    take: (key) => inner.take(key),
    get size() {
      return inner.size;
    },
  };
}

function makeService(opts: { store?: TtlCache<any>; imageTheme?: string | null } = {}) {
  const logger = stubLogger();
  const resolver = { resolveDidToHandle: mock(async () => "alice.bsky.social") };
  const service = new RenderService(
    stubDb(opts.imageTheme ?? null),
    resolver as any,
    logger,
    opts.store
  );
  return { service, logger, resolver };
}

function enqueueArgs(overrides: Partial<{ original: string; theme: string }> = {}) {
  return { did: "did:foo", tid: "tid-1", original: "why is the sky blue?", ...overrides };
}

describe("RenderService", () => {
  afterEach(() => {
    mock.restore();
    mock.clearAllMocks();
  });

  function stubImageGenerator(impl?: () => Promise<any>) {
    return spyOn(imageGenerator, "generateQuestionImage").mockImplementation(
      impl ?? (async () => ({ imageBlob: PNG, imageAltText: "alt", width: 720, height: 720 }))
    );
  }

  describe("content-addressed dedup", () => {
    test("two identical render requests produce one render", async () => {
      const generate = stubImageGenerator();
      const { service } = makeService();

      const [first, second] = await Promise.all([
        service.enqueue(enqueueArgs()),
        service.enqueue(enqueueArgs()),
      ]);
      await settle();

      assert.strictEqual(first.renderId, second.renderId);
      assert.strictEqual(generate.mock.calls.length, 1);
    });

    test("a theme change produces a second render", async () => {
      const generate = stubImageGenerator();
      const { service } = makeService();

      const first = await service.enqueue(enqueueArgs({ theme: "midnight" }));
      const second = await service.enqueue(enqueueArgs({ theme: "sunrise" }));
      await settle();

      assert.notStrictEqual(first.renderId, second.renderId);
      assert.strictEqual(generate.mock.calls.length, 2);
    });

    test("falls back to the stored theme when the request omits one", async () => {
      const generate = stubImageGenerator();
      const { service } = makeService({ imageTheme: "midnight" });

      await service.enqueue(enqueueArgs());
      await settle();

      assert.strictEqual(generate.mock.calls[0][3], "midnight");
    });

    test("uses the default theme when the user has no stored setting", async () => {
      const generate = stubImageGenerator();
      const { service } = makeService();

      await service.enqueue(enqueueArgs());
      await settle();

      assert.strictEqual(generate.mock.calls[0][3], "default");
    });
  });

  describe("TTL", () => {
    test("a render inside its TTL is claimable, and is written with the 10 minute TTL", async () => {
      stubImageGenerator();
      const store = recordingStore<any>();
      const { service } = makeService({ store });

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();
      const claim = service.claimReady(renderId, "did:foo");

      assert.strictEqual(claim.ok, true);
      assert.strictEqual(RENDER_TTL_MS, 10 * 60 * 1000);
      assert.ok(
        store.ttls.every((ttl) => ttl === RENDER_TTL_MS),
        `every write should use RENDER_TTL_MS, saw ${store.ttls.join(", ")}`
      );
    });

    test("a render past its TTL is gone, so a claim reads as unknown", async () => {
      stubImageGenerator();
      const { service } = makeService({ store: alreadyExpiredStore<any>() });

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();
      const claim = service.claimReady(renderId, "did:foo");

      assert.strictEqual(claim.ok, false);
      assert.strictEqual(claim.ok === false && claim.status, "unknown");
    });
  });

  describe("failure is terminal", () => {
    test("a failed render surfaces the specific error", async () => {
      stubImageGenerator(async () => {
        throw new Error("html-to-image 503: Browser unavailable");
      });
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();

      assert.deepStrictEqual(service.readStatus(renderId, "did:foo"), {
        status: "failed",
        error: "html-to-image 503: Browser unavailable",
      });
    });

    test("an image service that answers without bytes fails rather than posting nothing", async () => {
      stubImageGenerator(async () => ({}));
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();
      const report = service.readStatus(renderId, "did:foo");

      assert.strictEqual(report.status, "failed");
      assert.match(report.error ?? "", /still be starting up/);
    });

    test("reading a failed render clears it, so a retry re-renders", async () => {
      const generate = stubImageGenerator(async () => {
        throw new Error("boom");
      });
      const { service } = makeService();

      const first = await service.enqueue(enqueueArgs());
      await settle();
      service.readStatus(first.renderId, "did:foo");

      assert.strictEqual(service.readStatus(first.renderId, "did:foo").status, "unknown");

      const second = await service.enqueue(enqueueArgs());
      await settle();

      assert.strictEqual(second.renderId, first.renderId);
      assert.strictEqual(generate.mock.calls.length, 2);
    });
  });

  describe("a lost key is recoverable", () => {
    test("polling an unknown renderId returns unknown, not failed", () => {
      const { service } = makeService();

      assert.deepStrictEqual(service.readStatus("no-such-key", "did:foo"), { status: "unknown" });
    });

    test("a render belonging to another account reads as unknown", async () => {
      stubImageGenerator();
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();

      assert.deepStrictEqual(service.readStatus(renderId, OTHER_DID), { status: "unknown" });
    });

    test("a render still in flight polls as a non-terminal state", async () => {
      stubImageGenerator(() => new Promise(() => {}));
      const { service } = makeService();

      const { renderId, status } = await service.enqueue(enqueueArgs());
      assert.strictEqual(status, "pending");
      await settle();

      assert.strictEqual(service.readStatus(renderId, "did:foo").status, "rendering");
    });

    test("re-enqueuing a render already in flight returns its current status", async () => {
      stubImageGenerator(() => new Promise(() => {}));
      const { service } = makeService();

      const first = await service.enqueue(enqueueArgs());
      await settle();
      const second = await service.enqueue(enqueueArgs());

      assert.strictEqual(second.renderId, first.renderId);
      assert.strictEqual(second.status, "rendering");
    });
  });

  describe("the render key is single-use", () => {
    test("the first claim returns the image", async () => {
      stubImageGenerator();
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();
      const claim = service.claimReady(renderId, "did:foo");

      assert.strictEqual(claim.ok, true);
      assert.deepStrictEqual(claim.ok === true && claim.image.imageBlob, PNG);
    });

    test("a second claim with the same renderId gets unknown", async () => {
      stubImageGenerator();
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();
      service.claimReady(renderId, "did:foo");
      const second = service.claimReady(renderId, "did:foo");

      assert.strictEqual(second.ok, false);
      assert.strictEqual(second.ok === false && second.status, "unknown");
    });

    test("a claim on another account's render is refused", async () => {
      stubImageGenerator();
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();
      const claim = service.claimReady(renderId, OTHER_DID);

      assert.strictEqual(claim.ok, false);
      assert.strictEqual(claim.ok === false && claim.status, "unknown");
    });

    test("claiming a render still in flight reports it as not ready", async () => {
      stubImageGenerator(() => new Promise(() => {}));
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();
      const claim = service.claimReady(renderId, "did:foo");

      assert.strictEqual(claim.ok, false);
      assert.strictEqual(claim.ok === false && claim.status, "rendering");
      assert.match((claim.ok === false && claim.error) || "", /still rendering/);
    });

    test("claiming a failed render carries the render's own error", async () => {
      stubImageGenerator(async () => {
        throw new Error("boom");
      });
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();
      const claim = service.claimReady(renderId, "did:foo");

      assert.strictEqual(claim.ok === false && claim.status, "failed");
      assert.strictEqual(claim.ok === false && claim.error, "boom");
    });

    test("a non-Error rejection still leaves a usable message", async () => {
      stubImageGenerator(async () => {
        throw "just a string";
      });
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();
      const report = service.readStatus(renderId, "did:foo");

      assert.strictEqual(report.status, "failed");
      assert.ok((report.error ?? "").length > 0);
    });
  });

  describe("logging", () => {
    test("logs enqueue and completion without the question text", async () => {
      stubImageGenerator();
      const { service, logger } = makeService();

      await service.enqueue(enqueueArgs());
      await settle();

      const messages = logger.info.mock.calls.map((call: any[]) => call[1]);
      assert.ok(messages.includes("Question image render enqueued"));
      assert.ok(messages.includes("Question image render completed"));
      const fields = JSON.stringify(logger.info.mock.calls.map((call: any[]) => call[0]));
      assert.ok(!fields.includes("why is the sky blue?"), "the question must not be logged");
    });

    test("the first render of a quiet process is guessed cold", async () => {
      stubImageGenerator();
      const { service, logger } = makeService();

      await service.enqueue(enqueueArgs());

      assert.strictEqual(logger.info.mock.calls[0][0].cold, true);
    });

    test("a render that follows a fresh one is guessed warm", async () => {
      stubImageGenerator();
      const { service, logger } = makeService();

      await service.enqueue(enqueueArgs());
      await settle();
      await service.enqueue(enqueueArgs({ theme: "midnight" }));

      const enqueues = logger.info.mock.calls.filter(
        (call: any[]) => call[1] === "Question image render enqueued"
      );
      assert.strictEqual(enqueues[1][0].cold, false);
    });

    test("logs the failure so a render nobody waited for still leaves a trace", async () => {
      stubImageGenerator(async () => {
        throw new Error("boom");
      });
      const { service, logger } = makeService();

      await service.enqueue(enqueueArgs());
      await settle();

      assert.strictEqual(logger.error.mock.calls[0][1], "Question image render failed");
    });
  });

  /**
   * The product requirement, and the thing a future refactor is most likely to
   * quietly break: posting happens in an authenticated request with a live
   * session, never from the render worker. A user who signed out or closed the
   * tab must never have something posted on their behalf.
   */
  describe("user presence", () => {
    test("a render completes without an agent ever being supplied", async () => {
      stubImageGenerator();
      const { service } = makeService();

      const { renderId } = await service.enqueue(enqueueArgs());
      await settle();

      assert.strictEqual(service.readStatus(renderId, "did:foo").status, "ready");
    });

    test("no code path in the render service reaches an agent", () => {
      const source = readFileSync(
        new URL("../services/render-service.ts", import.meta.url),
        "utf8"
      ).replace(/^\s*\*.*$/gm, "");

      for (const forbidden of ["agent.", "uploadBlob", "@atproto/api"]) {
        assert.ok(
          !source.includes(forbidden),
          `render-service.ts must not reference ${forbidden}: posting stays in the request`
        );
      }
    });
  });
});
