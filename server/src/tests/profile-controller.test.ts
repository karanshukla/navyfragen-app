import assert from "node:assert";
import { test, describe, afterEach, mock } from "bun:test";

import { ProfileController } from "../controllers/profile-controller";

describe("ProfileController", () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  function makeCtx(): any {
    return {
      oauthClient: {
        restore: mock(async () => ({ sub: "did:foo" })),
      },
      resolver: {
        resolveHandleToDid: mock(async () => "did:foo"),
      },
      idResolver: {
        did: {
          resolveAtprotoData: mock(async () => ({ pds: "https://pds.example.com" })),
        },
      },
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
      getPublicProfile: mock(async () => ({ did: "did:foo", handle: "foo.bsky.social" })),
      checkUserExists: mock(async () => true),
      getFriendsOnApp: mock(async () => []),
      checkFollowsBot: mock(async () => false),
      resolveHandleToDid: mock(async () => "did:foo"),
      searchActorsTypeahead: mock(async () => []),
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
        getPublicProfile: mock(async () => {
          throw new Error("Profile not found");
        }),
      });
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getPublicProfile(makeReq({ params: { did: "did:foo" } }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 404);
    });

    test("returns 500 on other error", async () => {
      const ctx = makeCtx();
      const svc = makeService({
        getPublicProfile: mock(async () => {
          throw new Error("db error");
        }),
      });
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getPublicProfile(makeReq({ params: { did: "did:foo" } }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
    });
  });

  describe("checkUserExists", () => {
    test("returns exists result on success", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.checkUserExists(makeReq({ params: { did: "did:foo" } }), res);
      assert.deepStrictEqual(res.json.mock.calls[0][0], { exists: true, did: "did:foo" });
    });

    test("returns 500 on error", async () => {
      const ctx = makeCtx();
      const svc = makeService({
        checkUserExists: mock(async () => {
          throw new Error("db error");
        }),
      });
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.checkUserExists(makeReq({ params: { did: "did:foo" } }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
    });
  });

  describe("getFriends", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getFriends(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 403);
    });

    test("returns moots, following, and oomfs on success", async () => {
      const svc = makeService({
        getFriendsOnApp: mock(async () => ({
          moots: [{ did: "did:bar" }],
          following: [],
          oomfs: [],
        })),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getFriends(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0][0], {
        moots: [{ did: "did:bar" }],
        following: [],
        oomfs: [],
      });
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        getFriendsOnApp: mock(async () => {
          throw new Error("err");
        }),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.getFriends(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
    });
  });

  describe("checkBotFollow", () => {
    test("returns 403 when no session", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.checkBotFollow(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 403);
    });

    test("returns 401 when agent is null", async () => {
      const ctx = makeCtx();
      ctx.oauthClient.restore = mock(async () => null);
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.checkBotFollow(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0][0], 401);
    });

    test("returns following status on success", async () => {
      const svc = makeService({ checkFollowsBot: mock(async () => true) });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.checkBotFollow(makeReq(), res);
      assert.deepStrictEqual(res.json.mock.calls[0][0], { following: true });
    });

    test("returns 500 on error", async () => {
      const svc = makeService({
        checkFollowsBot: mock(async () => {
          throw new Error("err");
        }),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.checkBotFollow(makeReq(), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
    });
  });

  describe("getHandlePDS", () => {
    test("returns the PDS hostname on success", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getHandlePDS(makeReq({ params: { handle: "foo.bsky.social" } }), res);
      assert.deepStrictEqual(res.json.mock.calls[0][0], { pds: "pds.example.com" });
    });

    test("returns 404 when the handle does not resolve to a DID", async () => {
      const ctx = makeCtx();
      ctx.resolver.resolveHandleToDid = mock(async () => undefined);
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getHandlePDS(makeReq({ params: { handle: "nobody.bsky.social" } }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 404);
      assert.deepStrictEqual(res.json.mock.calls[0][0], { error: "Handle not found" });
    });

    test("returns 500 when PDS resolution throws", async () => {
      const ctx = makeCtx();
      ctx.idResolver.did.resolveAtprotoData = mock(async () => {
        throw new Error("network error");
      });
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.getHandlePDS(makeReq({ params: { handle: "foo.bsky.social" } }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
      assert.strictEqual(ctx.logger.error.mock.calls.length, 1);
    });
  });

  describe("searchHandles", () => {
    test("returns matching actors on success", async () => {
      const svc = makeService({
        searchActorsTypeahead: mock(async () => [{ did: "did:foo", handle: "foo.bsky.social" }]),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.searchHandles(makeReq({ query: { q: "foo" } }), res);
      assert.deepStrictEqual(res.json.mock.calls[0][0], {
        actors: [{ did: "did:foo", handle: "foo.bsky.social" }],
      });
    });

    test("returns 500 when the search fails", async () => {
      const svc = makeService({
        searchActorsTypeahead: mock(async () => {
          throw new Error("search failed");
        }),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.searchHandles(makeReq({ query: { q: "foo" } }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
      assert.strictEqual(ctx.logger.error.mock.calls.length, 1);
    });
  });

  describe("resolveHandle", () => {
    test("returns DID on success", async () => {
      const ctx = makeCtx();
      const controller = new ProfileController(makeService(), ctx.logger, ctx);
      const res = makeRes();
      await controller.resolveHandle(makeReq({ params: { handle: "foo.bsky.social" } }), res);
      assert.deepStrictEqual(res.json.mock.calls[0][0], { did: "did:foo" });
    });

    test("returns 404 when service throws 'Handle not found'", async () => {
      const svc = makeService({
        resolveHandleToDid: mock(async () => {
          throw new Error("Handle not found");
        }),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.resolveHandle(makeReq({ params: { handle: "nobody.bsky.social" } }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 404);
    });

    test("returns 500 on other error", async () => {
      const svc = makeService({
        resolveHandleToDid: mock(async () => {
          throw new Error("network");
        }),
      });
      const ctx = makeCtx();
      const controller = new ProfileController(svc, ctx.logger, ctx);
      const res = makeRes();
      await controller.resolveHandle(makeReq({ params: { handle: "foo.bsky.social" } }), res);
      assert.strictEqual(res.status.mock.calls[0][0], 500);
    });
  });
});
