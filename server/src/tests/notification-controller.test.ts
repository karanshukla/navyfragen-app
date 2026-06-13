import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import { NotificationController } from "../controllers/notification-controller";

describe("NotificationController", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  function makeService(): any {
    return {
      saveSubscription: mock.fn(async () => {}),
      deleteSubscription: mock.fn(async () => {}),
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
    test("returns 501 (not yet enabled)", async () => {
      const controller = new NotificationController(makeService(), makeLogger());
      const res = makeRes();
      await controller.getVapidPublicKey(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 501);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        error: "Web push not yet enabled",
      });
    });
  });

  describe("subscribe", () => {
    test("returns 403 when no session", async () => {
      const controller = new NotificationController(makeService(), makeLogger());
      const res = makeRes();
      await controller.subscribe(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns 501 when authenticated (stub)", async () => {
      const controller = new NotificationController(makeService(), makeLogger());
      const res = makeRes();
      await controller.subscribe(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 501);
    });
  });

  describe("unsubscribe", () => {
    test("returns 403 when no session", async () => {
      const controller = new NotificationController(makeService(), makeLogger());
      const res = makeRes();
      await controller.unsubscribe(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns 501 when authenticated (stub)", async () => {
      const controller = new NotificationController(makeService(), makeLogger());
      const res = makeRes();
      await controller.unsubscribe(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 501);
    });
  });
});
