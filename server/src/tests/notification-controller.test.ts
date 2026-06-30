import assert from "node:assert";
import { test, describe, mock, afterEach } from "node:test";

import { NotificationController } from "../controllers/notification-controller";

describe("NotificationController", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  function makeService(overrides: any = {}): any {
    return {
      getVapidPublicKey: mock.fn(() => "vapid-key"),
      saveSubscription: mock.fn(async () => {}),
      deleteSubscription: mock.fn(async () => {}),
      ...overrides,
    };
  }

  function makeLogger(): any {
    return {
      info: mock.fn(),
      error: mock.fn(),
      warn: mock.fn(),
      debug: mock.fn(),
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

  describe("getVapidPublicKey", () => {
    test("returns the key from the service when configured", async () => {
      const controller = new NotificationController(makeService(), makeLogger());
      const res = makeRes();
      await controller.getVapidPublicKey(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { vapidPublicKey: "vapid-key" });
    });

    test("returns 501 when VAPID is not configured", async () => {
      const controller = new NotificationController(
        makeService({ getVapidPublicKey: mock.fn(() => null) }),
        makeLogger()
      );
      const res = makeRes();
      await controller.getVapidPublicKey(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 501);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        error: "Web push not configured",
      });
    });
  });

  describe("subscribe", () => {
    const validBody = {
      endpoint: "https://push.example.com/sub",
      keys: { p256dh: "p256-key", auth: "auth-key" },
    };

    test("returns 403 when no session", async () => {
      const controller = new NotificationController(makeService(), makeLogger());
      const res = makeRes();
      await controller.subscribe(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns 501 when VAPID is not configured", async () => {
      const svc = makeService({ getVapidPublicKey: mock.fn(() => null) });
      const controller = new NotificationController(svc, makeLogger());
      const res = makeRes();
      await controller.subscribe(makeReq({ body: validBody }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 501);
    });

    test("saves subscription and returns 201 on success", async () => {
      const svc = makeService();
      const controller = new NotificationController(svc, makeLogger());
      const res = makeRes();
      await controller.subscribe(makeReq({ body: validBody }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 201);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { ok: true });
      const args = svc.saveSubscription.mock.calls[0].arguments;
      assert.strictEqual(args[0], "did:foo"); // did from session
      assert.strictEqual(args[1], "https://push.example.com/sub");
    });

    test("returns 500 when service throws", async () => {
      const svc = makeService({
        saveSubscription: mock.fn(async () => {
          throw new Error("db down");
        }),
      });
      const controller = new NotificationController(svc, makeLogger());
      const res = makeRes();
      await controller.subscribe(makeReq({ body: validBody }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("unsubscribe", () => {
    test("returns 403 when no session", async () => {
      const controller = new NotificationController(makeService(), makeLogger());
      const res = makeRes();
      await controller.unsubscribe(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("deletes subscription and returns ok on success", async () => {
      const svc = makeService();
      const controller = new NotificationController(svc, makeLogger());
      const res = makeRes();
      await controller.unsubscribe(
        makeReq({ body: { endpoint: "https://push.example.com/sub" } }),
        res
      );
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { ok: true });
      const args = svc.deleteSubscription.mock.calls[0].arguments;
      assert.strictEqual(args[0], "did:foo");
      assert.strictEqual(args[1], "https://push.example.com/sub");
    });

    test("returns 500 when service throws", async () => {
      const svc = makeService({
        deleteSubscription: mock.fn(async () => {
          throw new Error("db down");
        }),
      });
      const controller = new NotificationController(svc, makeLogger());
      const res = makeRes();
      await controller.unsubscribe(
        makeReq({ body: { endpoint: "https://push.example.com/sub" } }),
        res
      );
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });
});
