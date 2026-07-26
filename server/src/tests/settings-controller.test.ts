import assert from "node:assert";
import { test, describe, afterEach, mock } from "bun:test";

import { SettingsController } from "../controllers/settings-controller";

describe("SettingsController", () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  function makeCtx(): any {
    return {
      oauthClient: {
        restore: mock(async () => ({ sub: "did:foo" })),
      },
      idResolver: {},
      logger: {
        info: mock(),
        error: mock(),
        warn: mock(),
        debug: mock(),
      },
    };
  }

  function makeService(overrides: any = {}): any {
    return {
      getUserSettings: mock(async () => ({ pdsSyncEnabled: true, imageTheme: "default" })),
      createDefaultSettings: mock(async () => ({
        pdsSyncEnabled: false,
        imageTheme: "default",
      })),
      getStats: mock(async () => ({ messageCount: 0 })),
      getPdsInfo: mock(async () => ({ pdsUrl: "https://bsky.social", count: 0 })),
      updateSettings: mock(async () => ({ pdsSyncEnabled: true, imageTheme: "compressed" })),
      ...overrides,
    };
  }

  function makeReq(overrides: any = {}): any {
    return { body: {}, session: { did: "did:foo" }, params: {}, ...overrides };
  }

  function makeRes(): any {
    const res: any = {};
    res.status = mock(() => res);
    res.json = mock(() => res);
    return res;
  }

  describe("getSettings", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getSettings(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 403);
    });

    test("returns existing settings when found", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getSettings(makeReq(), res);
      assert.ok(res.json.mock.calls.length === 1);
    });

    test("creates and returns default settings when none exist", async () => {
      const svc = makeService({ getUserSettings: mock(async () => null) });
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getSettings(makeReq(), res);
      assert.ok(svc.createDefaultSettings.mock.calls.length === 1);
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        getUserSettings: mock(async () => {
          throw new Error("db");
        }),
      });
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getSettings(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
    });
  });

  describe("getStats", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getStats(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 403);
    });

    test("returns stats on success", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getStats(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0][0], { messageCount: 0 });
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        getStats: mock(async () => {
          throw new Error("db");
        }),
      });
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getStats(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
    });
  });

  describe("getPdsInfo", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getPdsInfo(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 403);
    });

    test("returns 401 when agent is null", async () => {
      const ctx = makeCtx();
      ctx.oauthClient.restore = mock(async () => null);
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getPdsInfo(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0][0], 401);
    });

    test("returns PDS info on success", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getPdsInfo(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0][0], {
        pdsUrl: "https://bsky.social",
        count: 0,
      });
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        getPdsInfo: mock(async () => {
          throw new Error("err");
        }),
      });
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getPdsInfo(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
    });
  });

  describe("updateSettings", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.updateSettings(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 403);
    });

    test("returns updated settings on success", async () => {
      const ctx = makeCtx();
      const controller = new SettingsController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.updateSettings(
        makeReq({ body: { pdsSyncEnabled: true, imageTheme: "compressed" } }),
        res
      );
      assert.deepStrictEqual(res.json.mock.calls[0][0], {
        pdsSyncEnabled: true,
        imageTheme: "compressed",
      });
    });

    test("passes only provided fields through to the service (partial update)", async () => {
      // A /customise card mutates one field at a time; the controller must not
      // inject defaults for fields the client didn't send (undefined = skip).
      const svc = makeService();
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.updateSettings(makeReq({ body: { inboxEnabled: false } }), res);

      const passed = svc.updateSettings.mock.calls[0][1];
      assert.deepStrictEqual(passed, {
        pdsSyncEnabled: undefined,
        imageTheme: undefined,
        inboxEnabled: false,
        profanityFilterEnabled: undefined,
        customPrompt: undefined,
        profileCardTheme: undefined,
        touchpointLocale: undefined,
      });
    });

    test("passes null through for nullable fields (means 'unset')", async () => {
      const svc = makeService();
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.updateSettings(
        makeReq({ body: { customPrompt: null, touchpointLocale: "es" } }),
        res
      );
      const passed = svc.updateSettings.mock.calls[0][1];
      assert.strictEqual(passed.customPrompt, null); // null, not undefined
      assert.strictEqual(passed.touchpointLocale, "es");
    });

    test("coerces profanityFilterEnabled to a strict boolean when provided", async () => {
      const svc = makeService();
      const ctx = makeCtx();
      const controller = new SettingsController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.updateSettings(makeReq({ body: { profanityFilterEnabled: true } }), res);
      const passed = svc.updateSettings.mock.calls[0][1];
      assert.strictEqual(passed.profanityFilterEnabled, true);
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        updateSettings: mock(async () => {
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
      assert.strictEqual(res.status.mock.calls[0][0], 500);
    });
  });
});
