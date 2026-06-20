import assert from "node:assert";
import { test, describe, mock, afterEach } from "node:test";

import { ProfileController } from "../controllers/profile-controller";

describe("ProfileController", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  function makeCtx(): any {
    return {
      oauthClient: {
        restore: mock.fn(async () => ({ sub: "did:foo" })),
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
      getPublicProfile: mock.fn(async () => ({ did: "did:foo", handle: "foo.bsky.social" })),
      checkUserExists: mock.fn(async () => true),
      getFriendsOnApp: mock.fn(async () => []),
      checkFollowsBot: mock.fn(async () => false),
      resolveHandleToDid: mock.fn(async () => "did:foo"),
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

  describe("getPublicProfile", () => {
    test("returns profile on success", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getPublicProfile(makeReq({ params: { did: "did:foo" } }), res);
      assert.ok(res.json.mock.calls.length === 1);
    });

    test("returns 404 when service throws 'Profile not found'", async () => {
      const ctx = makeCtx();
      const svc = makeService({
        getPublicProfile: mock.fn(async () => {
          throw new Error("Profile not found");
        }),
      });
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getPublicProfile(makeReq({ params: { did: "did:foo" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
    });

    test("returns 500 on other error", async () => {
      const ctx = makeCtx();
      const svc = makeService({
        getPublicProfile: mock.fn(async () => {
          throw new Error("db error");
        }),
      });
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getPublicProfile(makeReq({ params: { did: "did:foo" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("checkUserExists", () => {
    test("returns exists result on success", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.checkUserExists(makeReq({ params: { did: "did:foo" } }), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { exists: true, did: "did:foo" });
    });

    test("returns 500 on error", async () => {
      const ctx = makeCtx();
      const svc = makeService({
        checkUserExists: mock.fn(async () => {
          throw new Error("db error");
        }),
      });
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.checkUserExists(makeReq({ params: { did: "did:foo" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("getFriends", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getFriends(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns 401 when agent is null", async () => {
      const ctx = makeCtx();
      ctx.oauthClient.restore = mock.fn(async () => null);
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getFriends(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    test("returns moots, following, and oomfs on success", async () => {
      const svc = makeService({
        getFriendsOnApp: mock.fn(async () => ({
          moots: [{ did: "did:bar" }],
          following: [],
          oomfs: [],
        })),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getFriends(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        moots: [{ did: "did:bar" }],
        following: [],
        oomfs: [],
      });
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        getFriendsOnApp: mock.fn(async () => {
          throw new Error("err");
        }),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getFriends(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("checkBotFollow", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.checkBotFollow(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    test("returns 401 when agent is null", async () => {
      const ctx = makeCtx();
      ctx.oauthClient.restore = mock.fn(async () => null);
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.checkBotFollow(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    test("returns following status on success", async () => {
      const svc = makeService({ checkFollowsBot: mock.fn(async () => true) });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.checkBotFollow(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { following: true });
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        checkFollowsBot: mock.fn(async () => {
          throw new Error("err");
        }),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.checkBotFollow(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("resolveHandle", () => {
    test("returns DID on success", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.resolveHandle(makeReq({ params: { handle: "foo.bsky.social" } }), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { did: "did:foo" });
    });

    test("returns 404 when service throws 'Handle not found'", async () => {
      const svc = makeService({
        resolveHandleToDid: mock.fn(async () => {
          throw new Error("Handle not found");
        }),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.resolveHandle(makeReq({ params: { handle: "nobody.bsky.social" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
    });

    test("returns 500 on other error", async () => {
      const svc = makeService({
        resolveHandleToDid: mock.fn(async () => {
          throw new Error("network");
        }),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.resolveHandle(makeReq({ params: { handle: "foo.bsky.social" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });
});
