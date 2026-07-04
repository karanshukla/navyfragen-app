import assert from "node:assert";
import { test, describe, mock, afterEach } from "node:test";

import { MessageController } from "../controllers/message-controller";

describe("MessageController", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  function makeCtx(dbResult: any = null): any {
    return {
      oauthClient: {
        restore: mock.fn(async () => ({ sub: "did:foo" })),
      },
      db: {
        selectFrom: mock.fn(() => ({
          selectAll: mock.fn(function (this: any) {
            return this as any;
          }),
          where: mock.fn(function (this: any) {
            return this as any;
          }),
          executeTakeFirst: mock.fn(async () => dbResult),
        })),
      },
      logger: {
        info: mock.fn(),
        error: mock.fn(),
        warn: mock.fn(),
        debug: mock.fn(),
      },
    };
  }

  function makeService(overrides: any = {}): any {
    return {
      addExampleMessages: mock.fn(async () => [{ tid: "t1", message: "hello" }]),
      respondToMessage: mock.fn(async () => ({ success: true })),
      sendMessage: mock.fn(async () => ({ tid: "t2" })),
      getMessages: mock.fn(async () => []),
      deleteMessage: mock.fn(async () => {}),
      deleteUserData: mock.fn(async () => {}),
      syncMessages: mock.fn(async () => ({ synced: 1 })),
      ...overrides,
    };
  }

  function makeNotificationService(overrides: any = {}): any {
    return {
      sendNewMessageNotification: mock.fn(async () => {}),
      deleteAllSubscriptionsForUser: mock.fn(async () => {}),
      ...overrides,
    };
  }

  function makeReq(overrides: any = {}): any {
    return { body: {}, session: { did: "did:foo" }, params: {}, ...overrides };
  }

  function makeRes(): any {
    const res: any = {};
    res.status = mock.fn(() => res);
    res.json = mock.fn(() => res);
    return res;
  }

  describe("addExampleMessages", () => {
    test("returns 403 when no session", async () => {
      const controller = new MessageController(makeService(), makeCtx().logger, makeCtx());
      const res = makeRes();
      await controller.addExampleMessages(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns messages on success", async () => {
      const svc = makeService();
      const controller = new MessageController(svc, makeCtx().logger, makeCtx());
      const res = makeRes();
      await controller.addExampleMessages(makeReq(), res);
      assert.ok(res.json.mock.calls.length === 1);
    });

    test("returns 500 when service throws", async () => {
      const svc = makeService({
        addExampleMessages: mock.fn(async () => {
          throw new Error("db");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.addExampleMessages(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("respondToMessage", () => {
    test("returns 400 when required fields are missing", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.respondToMessage(
        makeReq({ body: { tid: null, recipient: null, response: null } }),
        res
      );
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
    });

    test("returns 403 when no session", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.respondToMessage(
        makeReq({ session: null, body: { tid: "t1", recipient: "did:foo", response: "hi" } }),
        res
      );
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns isLoggedIn:false when agent is null (restore returns null)", async () => {
      const svc = makeService();
      const ctx = makeCtx();
      ctx.oauthClient.restore = mock.fn(async () => null);
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.respondToMessage(
        makeReq({ body: { tid: "t1", recipient: "did:foo", response: "hi" } }),
        res
      );
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        isLoggedIn: false,
        profile: null,
        did: null,
      });
    });

    test("returns result on success", async () => {
      const svc = makeService();
      const ctx = makeCtx();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.respondToMessage(
        makeReq({
          body: { tid: "t1", recipient: "did:foo", response: "hi", original: "question" },
        }),
        res
      );
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { success: true });
    });

    test("passes includeQuestionAsImage=true to service when present in body", async () => {
      const svc = makeService();
      const ctx = makeCtx();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.respondToMessage(
        makeReq({
          body: {
            tid: "t1",
            recipient: "did:foo",
            response: "hi",
            original: "question",
            includeQuestionAsImage: true,
          },
        }),
        res
      );
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { success: true });
      const callArgs = (svc.respondToMessage as any).mock.calls[0].arguments;
      assert.strictEqual(callArgs[5], true);
    });

    test("returns 500 with error message when service throws with non-empty message", async () => {
      const svc = makeService({
        respondToMessage: mock.fn(async () => {
          throw new Error("");
        }),
      });
      const ctx = makeCtx();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.respondToMessage(
        makeReq({ body: { tid: "t1", recipient: "did:foo", response: "hi" } }),
        res
      );
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
      assert.strictEqual(res.json.mock.calls[0].arguments[0].error, "Failed to post to Bluesky");
    });

    test("returns 500 when service throws", async () => {
      const svc = makeService({
        respondToMessage: mock.fn(async () => {
          throw new Error("bluesky error");
        }),
      });
      const ctx = makeCtx();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.respondToMessage(
        makeReq({ body: { tid: "t1", recipient: "did:foo", response: "hi" } }),
        res
      );
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("sendMessage", () => {
    test("returns 400 when recipient or message missing", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.sendMessage(makeReq({ body: {} }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
    });

    test("returns result on success", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.sendMessage(
        makeReq({ body: { recipient: "did:foo", message: "hello" } }),
        res
      );
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { tid: "t2" });
    });

    test("triggers sendNewMessageNotification (fire-and-forget) on success", async () => {
      const svc = makeService();
      const notifications = makeNotificationService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx(), notifications);
      const res = makeRes();
      await controller.sendMessage(
        makeReq({ body: { recipient: "did:recipient", message: "hi" } }),
        res
      );
      // Push is invoked with the recipient DID (not the sender — there is no
      // authenticated sender on the public send endpoint).
      assert.strictEqual(notifications.sendNewMessageNotification.mock.calls.length, 1);
      assert.strictEqual(
        notifications.sendNewMessageNotification.mock.calls[0].arguments[0],
        "did:recipient"
      );
    });

    test("logs an error when the fire-and-forget push notification rejects", async () => {
      const svc = makeService();
      const notifications = makeNotificationService({
        sendNewMessageNotification: mock.fn(async () => {
          throw new Error("push failed");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx(), notifications);
      const res = makeRes();
      await controller.sendMessage(
        makeReq({ body: { recipient: "did:recipient", message: "hi" } }),
        res
      );
      // The push call isn't awaited by the controller, so give its .catch() a tick to run.
      await new Promise((resolve) => setImmediate(resolve));
      assert.strictEqual(logger.error.mock.calls.length, 1);
      assert.strictEqual(
        logger.error.mock.calls[0].arguments[1],
        "Failed to send push notification"
      );
    });

    test("returns 404 when service throws with 'not found'", async () => {
      const svc = makeService({
        sendMessage: mock.fn(async () => {
          throw new Error("User not found");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.sendMessage(makeReq({ body: { recipient: "did:foo", message: "hi" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
    });

    test("returns 500 when service throws other error", async () => {
      const svc = makeService({
        sendMessage: mock.fn(async () => {
          throw new Error("db exploded");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.sendMessage(makeReq({ body: { recipient: "did:foo", message: "hi" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });

    test("returns 500 with fallback message when error has empty message string", async () => {
      const err = new Error("");
      const svc = makeService({
        sendMessage: mock.fn(async () => {
          throw err;
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.sendMessage(makeReq({ body: { recipient: "did:foo", message: "hi" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
      assert.strictEqual(res.json.mock.calls[0].arguments[0].error, "Failed to send message");
    });
  });

  describe("getMessages", () => {
    test("returns 403 when no session", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.getMessages(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns messages on success", async () => {
      const svc = makeService({ getMessages: mock.fn(async () => [{ tid: "t1" }]) });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.getMessages(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { messages: [{ tid: "t1" }] });
    });

    test("returns 404 when service throws with 'not exist'", async () => {
      const svc = makeService({
        getMessages: mock.fn(async () => {
          throw new Error("Profile does not exist");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.getMessages(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
    });

    test("returns 500 on other error", async () => {
      const svc = makeService({
        getMessages: mock.fn(async () => {
          throw new Error("db error");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.getMessages(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("deleteMessage", () => {
    test("returns 400 when tid is missing from params", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteMessage(makeReq({ params: {} }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
    });

    test("returns 403 when no session", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteMessage(makeReq({ params: { tid: "t1" }, session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns isLoggedIn:false when agent is null", async () => {
      const svc = makeService();
      const ctx = makeCtx();
      ctx.oauthClient.restore = mock.fn(async () => null);
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.deleteMessage(makeReq({ params: { tid: "t1" } }), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        isLoggedIn: false,
        profile: null,
        did: null,
      });
    });

    test("returns success on delete", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteMessage(makeReq({ params: { tid: "t1" } }), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { success: true });
    });

    test("returns 404 when service throws 'not found'", async () => {
      const svc = makeService({
        deleteMessage: mock.fn(async () => {
          throw new Error("Message not found");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteMessage(makeReq({ params: { tid: "t1" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
    });

    test("returns 403 when service throws 'Not authorized'", async () => {
      const svc = makeService({
        deleteMessage: mock.fn(async () => {
          throw new Error("Not authorized");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteMessage(makeReq({ params: { tid: "t1" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns 500 on other error", async () => {
      const svc = makeService({
        deleteMessage: mock.fn(async () => {
          throw new Error("db exploded");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteMessage(makeReq({ params: { tid: "t1" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });

    test("returns 500 with fallback message when error has empty message string", async () => {
      const err = new Error("");
      const svc = makeService({
        deleteMessage: mock.fn(async () => {
          throw err;
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteMessage(makeReq({ params: { tid: "t1" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
      assert.strictEqual(res.json.mock.calls[0].arguments[0].error, "Failed to delete message");
    });
  });

  describe("deleteAccount", () => {
    test("returns 403 when no session", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteAccount(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns 401 when agent is null", async () => {
      const svc = makeService();
      const ctx = makeCtx();
      ctx.oauthClient.restore = mock.fn(async () => null);
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.deleteAccount(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    test("clears session and returns success", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const req = makeReq();
      const res = makeRes();
      await controller.deleteAccount(req, res);
      assert.strictEqual(req.session, null);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { success: true });
    });

    test("drops push subscriptions (fire-and-forget) on success", async () => {
      const svc = makeService();
      const notifications = makeNotificationService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx(), notifications);
      const req = makeReq();
      const res = makeRes();
      await controller.deleteAccount(req, res);
      assert.strictEqual(notifications.deleteAllSubscriptionsForUser.mock.calls.length, 1);
      assert.strictEqual(
        notifications.deleteAllSubscriptionsForUser.mock.calls[0].arguments[0],
        "did:foo"
      );
    });

    test("logs an error when dropping push subscriptions (fire-and-forget) rejects", async () => {
      const svc = makeService();
      const notifications = makeNotificationService({
        deleteAllSubscriptionsForUser: mock.fn(async () => {
          throw new Error("db unavailable");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx(), notifications);
      const req = makeReq();
      const res = makeRes();
      await controller.deleteAccount(req, res);
      // The push cleanup isn't awaited by the controller, so give its .catch() a tick to run.
      await new Promise((resolve) => setImmediate(resolve));
      assert.strictEqual(logger.error.mock.calls.length, 1);
      assert.strictEqual(
        logger.error.mock.calls[0].arguments[1],
        "Failed to delete push subscriptions"
      );
    });

    test("returns 500 when service throws", async () => {
      const svc = makeService({
        deleteUserData: mock.fn(async () => {
          throw new Error("delete failed");
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteAccount(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });

    test("returns 500 with fallback message when error has empty message string", async () => {
      const err = new Error("");
      const svc = makeService({
        deleteUserData: mock.fn(async () => {
          throw err;
        }),
      });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.deleteAccount(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
      assert.strictEqual(
        res.json.mock.calls[0].arguments[0].error,
        "Failed to delete account data"
      );
    });
  });

  describe("syncMessages", () => {
    test("returns 403 when no session", async () => {
      const svc = makeService();
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, makeCtx());
      const res = makeRes();
      await controller.syncMessages(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns 200 with disabled message when no settings row", async () => {
      const svc = makeService();
      const ctx = makeCtx(null);
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.syncMessages(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        success: true,
        message: "PDS sync is disabled",
      });
    });

    test("returns 200 with disabled message when pdsSyncEnabled is false", async () => {
      const svc = makeService();
      const ctx = makeCtx({ pdsSyncEnabled: false });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.syncMessages(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        success: true,
        message: "PDS sync is disabled",
      });
    });

    test("returns 401 when pdsSyncEnabled true but agent is null", async () => {
      const svc = makeService();
      const ctx = makeCtx({ pdsSyncEnabled: true });
      ctx.oauthClient.restore = mock.fn(async () => null);
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.syncMessages(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    test("returns sync result on success", async () => {
      const svc = makeService({ syncMessages: mock.fn(async () => ({ synced: 5 })) });
      const ctx = makeCtx({ pdsSyncEnabled: true });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.syncMessages(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { synced: 5 });
    });

    test("returns 500 when syncMessages throws", async () => {
      const svc = makeService({
        syncMessages: mock.fn(async () => {
          throw new Error("sync failed");
        }),
      });
      const ctx = makeCtx({ pdsSyncEnabled: true });
      const logger = { info: mock.fn(), error: mock.fn(), warn: mock.fn(), debug: mock.fn() };
      const controller = new MessageController(svc, logger, ctx);
      const res = makeRes();
      await controller.syncMessages(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });
});
