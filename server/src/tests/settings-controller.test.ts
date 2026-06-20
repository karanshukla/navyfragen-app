import assert from "node:assert";
import { test, describe, mock, afterEach } from "node:test";

import { SettingsController } from "../controllers/settings-controller";

describe("SettingsController", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  function makeCtx(): any {
    return {
      oauthClient: {
        restore: mock.fn(async () => ({ sub: "did:foo" })),
      },
      idResolver: {},
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
      getUserSettings: mock.fn(async () => ({ pdsSyncEnabled: true, imageTheme: "default" })),
      createDefaultSettings: mock.fn(async () => ({
        pdsSyncEnabled: false,
        imageTheme: "default",
      })),
      getStats: mock.fn(async () => ({ messageCount: 0 })),
      getPdsInfo: mock.fn(async () => ({ pdsUrl: "https://bsky.social", count: 0 })),
      updateSettings: mock.fn(async () => ({ pdsSyncEnabled: true, imageTheme: "compressed" })),
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

  describe("getSettings", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getSettings(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns existing settings when found", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getSettings(makeReq(), res);
      assert.ok(res.json.mock.calls.length === 1);
    });

    test("creates and returns default settings when none exist", async () => {
      const svc = makeService({ getUserSettings: mock.fn(async () => null) });
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getSettings(makeReq(), res);
      assert.ok(svc.createDefaultSettings.mock.calls.length === 1);
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        getUserSettings: mock.fn(async () => {
          throw new Error("db");
        }),
      });
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getSettings(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("getStats", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getStats(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns stats on success", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getStats(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { messageCount: 0 });
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        getStats: mock.fn(async () => {
          throw new Error("db");
        }),
      });
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getStats(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("getPdsInfo", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getPdsInfo(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns 401 when agent is null", async () => {
      const ctx = makeCtx();
      ctx.oauthClient.restore = mock.fn(async () => null);
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getPdsInfo(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    test("returns PDS info on success", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getPdsInfo(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        pdsUrl: "https://bsky.social",
        count: 0,
      });
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        getPdsInfo: mock.fn(async () => {
          throw new Error("err");
        }),
      });
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getPdsInfo(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("updateSettings", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.updateSettings(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns updated settings on success", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.updateSettings(
        makeReq({ body: { pdsSyncEnabled: true, imageTheme: "compressed" } }),
        res
      );
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        pdsSyncEnabled: true,
        imageTheme: "compressed",
      });
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        updateSettings: mock.fn(async () => {
          throw new Error("db");
        }),
      });
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.updateSettings(
        makeReq({ body: { pdsSyncEnabled: false, imageTheme: "default" } }),
        res
      );
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });
});
