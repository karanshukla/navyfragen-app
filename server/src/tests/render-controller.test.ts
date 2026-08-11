import assert from "node:assert";
import { test, describe, afterEach, mock, spyOn } from "bun:test";

import { createMessageHono, type MessageDeps } from "#/hono/message-routes";
import { imageGenerator } from "#/lib/image-generator";
import { RenderService } from "#/services/render-service";
import { withTestSession, sessionHeader } from "./helpers/hono-test";

import type { AppContext } from "#/index";

const PNG = Buffer.from("fake-png");
const RESPOND_BODY = {
  tid: "tid-1",
  recipient: "did:bar",
  original: "why is the sky blue?",
  response: "because of Rayleigh scattering",
  includeQuestionAsImage: true,
};

/** `preRendered` is the ninth positional argument to `respondToMessage`. */
const PRE_RENDERED_ARG = 8;

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * The inbox the render route checks against. `question: null` is an inbox that
 * holds nothing under the tid, which is what a render of a question the caller
 * does not own looks like from the DB.
 */
function stubDb(question: string | null = RESPOND_BODY.original): any {
  return {
    selectFrom: mock((table: string) => {
      const builder: any = {
        selectAll: () => builder,
        select: () => builder,
        where: () => builder,
        executeTakeFirst: async () =>
          table === "message" && question !== null ? { message: question } : undefined,
      };
      return builder;
    }),
  };
}

function makeCtx(question: string | null = RESPOND_BODY.original): AppContext {
  return {
    db: stubDb(question) as any,
    oauthClient: { restore: mock(async () => ({ sub: "did:foo" })) } as any,
    resolver: { resolveDidToHandle: mock(async () => "alice.bsky.social") } as any,
    idResolver: {} as any,
    logger: { info: mock(), error: mock(), warn: mock(), debug: mock() } as any,
  };
}

describe("Question image render pipeline (Hono)", () => {
  afterEach(() => {
    mock.restore();
    mock.clearAllMocks();
  });

  function stubImageGenerator(impl?: () => Promise<any>) {
    return spyOn(imageGenerator, "generateQuestionImage").mockImplementation(
      impl ?? (async () => ({ imageBlob: PNG, imageAltText: "alt", width: 720, height: 720 }))
    );
  }

  function makeApp(deps: Partial<MessageDeps> = {}, inboxQuestion?: string | null) {
    const ctx = makeCtx(inboxQuestion === undefined ? RESPOND_BODY.original : inboxQuestion);
    const messageService: any = {
      respondToMessage: mock(async () => ({ success: true, uri: "at://x", cid: "c" })),
      warmImageService: mock(async () => {}),
    };
    const renderService =
      deps.renderService ?? new RenderService(ctx.db, ctx.resolver as any, ctx.logger);
    const app = withTestSession(
      createMessageHono(ctx, { messageService, renderService, ...deps } as MessageDeps)
    );
    return {
      app,
      ctx,
      messageService,
      renderService,
      headers: {
        ...sessionHeader({ did: "did:foo" }),
        "Content-Type": "application/json",
      },
    };
  }

  function postJson(app: any, path: string, headers: any, body: unknown) {
    return app.request(path, { method: "POST", headers, body: JSON.stringify(body) });
  }

  async function enqueueReadyRender(app: any, headers: any): Promise<string> {
    const res = await postJson(app, "/messages/render", headers, {
      tid: "tid-1",
      original: RESPOND_BODY.original,
    });
    const { renderId } = await res.json();
    await settle();
    return renderId;
  }

  describe("POST /messages/render", () => {
    test("answers 202 with a render id", async () => {
      stubImageGenerator();
      const { app, headers } = makeApp();

      const res = await postJson(app, "/messages/render", headers, {
        tid: "tid-1",
        original: RESPOND_BODY.original,
      });

      assert.strictEqual(res.status, 202);
      const body = await res.json();
      assert.strictEqual(typeof body.renderId, "string");
      assert.strictEqual(body.status, "pending");
      await settle();
    });

    test("returns 403 without a session", async () => {
      const { app } = makeApp();

      const res = await postJson(
        app,
        "/messages/render",
        { "Content-Type": "application/json" },
        { tid: "tid-1", original: "hi" }
      );

      assert.strictEqual(res.status, 403);
    });

    test("returns 400 when the question is missing", async () => {
      const { app, headers } = makeApp();

      const res = await postJson(app, "/messages/render", headers, { tid: "tid-1" });

      assert.strictEqual(res.status, 400);
    });

    test("returns 404 for a question the caller's inbox does not hold", async () => {
      const generate = stubImageGenerator();
      const { app, headers } = makeApp({}, null);

      const res = await postJson(app, "/messages/render", headers, {
        tid: "tid-1",
        original: "text nobody ever asked me",
      });

      assert.strictEqual(res.status, 404);
      await settle();
      assert.strictEqual(generate.mock.calls.length, 0);
    });

    test("rejects a question longer than an inbox can hold, before any DB work", async () => {
      const { app, headers, ctx } = makeApp();

      const res = await postJson(app, "/messages/render", headers, {
        tid: "tid-1",
        original: "x".repeat(501),
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual((ctx.db.selectFrom as any).mock.calls.length, 0);
    });

    test("returns 500 when the enqueue itself fails", async () => {
      const renderService: any = {
        enqueue: mock(async () => {
          throw new Error("resolver down");
        }),
        readStatus: mock(),
        claimReady: mock(),
      };
      const { app, headers } = makeApp({ renderService });

      const res = await postJson(app, "/messages/render", headers, {
        tid: "tid-1",
        original: "hi",
      });

      assert.strictEqual(res.status, 500);
      assert.strictEqual((await res.json()).error, "resolver down");
    });
  });

  describe("GET /messages/render/:renderId", () => {
    test("reports ready once the render lands", async () => {
      stubImageGenerator();
      const { app, headers } = makeApp();
      const renderId = await enqueueReadyRender(app, headers);

      const res = await app.request(`/messages/render/${renderId}`, { headers });

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(await res.json(), { status: "ready" });
    });

    test("reports unknown for a key this process never saw", async () => {
      const { app, headers } = makeApp();

      const res = await app.request("/messages/render/deadbeef", { headers });

      assert.deepStrictEqual(await res.json(), { status: "unknown" });
    });

    test("returns 403 without a session", async () => {
      const { app } = makeApp();

      const res = await app.request("/messages/render/deadbeef");

      assert.strictEqual(res.status, 403);
    });
  });

  describe("POST /messages/respond with a renderId", () => {
    test("a ready render is posted without ever calling the image service", async () => {
      const generate = stubImageGenerator();
      const { app, headers, messageService } = makeApp();
      const renderId = await enqueueReadyRender(app, headers);
      generate.mockClear();

      const res = await postJson(app, "/messages/respond", headers, { ...RESPOND_BODY, renderId });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(generate.mock.calls.length, 0);
      const preRendered = messageService.respondToMessage.mock.calls[0][PRE_RENDERED_ARG];
      assert.deepStrictEqual(preRendered.imageBlob, PNG);
    });

    test("respond with no renderId still renders synchronously", async () => {
      stubImageGenerator();
      const { app, headers, messageService } = makeApp();

      const res = await postJson(app, "/messages/respond", headers, RESPOND_BODY);

      assert.strictEqual(res.status, 200);
      const preRendered = messageService.respondToMessage.mock.calls[0][PRE_RENDERED_ARG];
      assert.strictEqual(preRendered, undefined);
    });

    test("a render still in flight answers 409 so the client keeps polling", async () => {
      stubImageGenerator(() => new Promise(() => {}));
      const { app, headers, messageService } = makeApp();
      const renderId = await enqueueReadyRender(app, headers);

      const res = await postJson(app, "/messages/respond", headers, { ...RESPOND_BODY, renderId });

      assert.strictEqual(res.status, 409);
      assert.strictEqual((await res.json()).status, "rendering");
      assert.strictEqual(messageService.respondToMessage.mock.calls.length, 0);
    });

    test("an expired or lost renderId answers 409 unknown rather than posting", async () => {
      const { app, headers, messageService } = makeApp();

      const res = await postJson(app, "/messages/respond", headers, {
        ...RESPOND_BODY,
        renderId: "deadbeef",
      });

      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.status, "unknown");
      assert.strictEqual(typeof body.error, "string");
      assert.strictEqual(messageService.respondToMessage.mock.calls.length, 0);
    });

    test("the first respond consumes the key and posts", async () => {
      stubImageGenerator();
      const { app, headers, messageService } = makeApp();
      const renderId = await enqueueReadyRender(app, headers);

      const res = await postJson(app, "/messages/respond", headers, { ...RESPOND_BODY, renderId });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(messageService.respondToMessage.mock.calls.length, 1);
    });

    test("a second respond with the same renderId gets unknown and does not post", async () => {
      stubImageGenerator();
      const { app, headers, messageService } = makeApp();
      const renderId = await enqueueReadyRender(app, headers);

      await postJson(app, "/messages/respond", headers, { ...RESPOND_BODY, renderId });
      const second = await postJson(app, "/messages/respond", headers, {
        ...RESPOND_BODY,
        renderId,
      });

      assert.strictEqual(second.status, 409);
      assert.strictEqual((await second.json()).status, "unknown");
      assert.strictEqual(messageService.respondToMessage.mock.calls.length, 1);
    });

    test("a text-only reply ignores a renderId and leaves the key intact", async () => {
      stubImageGenerator();
      const { app, headers, renderService } = makeApp();
      const renderId = await enqueueReadyRender(app, headers);

      const res = await postJson(app, "/messages/respond", headers, {
        ...RESPOND_BODY,
        includeQuestionAsImage: false,
        renderId,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        (renderService as RenderService).readStatus(renderId, "did:foo").status,
        "ready"
      );
    });

    test("the key is only consumed once a live session has produced an agent", async () => {
      stubImageGenerator();
      const { app, headers, renderService, ctx } = makeApp();
      const renderId = await enqueueReadyRender(app, headers);
      (ctx as any).oauthClient.restore = mock(async () => null);

      await postJson(app, "/messages/respond", headers, { ...RESPOND_BODY, renderId });

      assert.strictEqual(
        (renderService as RenderService).readStatus(renderId, "did:foo").status,
        "ready"
      );
    });
  });
});
