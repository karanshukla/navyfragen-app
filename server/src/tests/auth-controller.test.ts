import assert from "node:assert";
import { test, describe, mock, before, afterEach } from "node:test";

import { AuthController } from "../controllers/auth-controller";

describe("AuthController", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  function makeCtx(overrides: any = {}): any {
    return {
      oauthClient: {
        clientMetadata: { client_id: "test-client" },
        callback: mock.fn(async () => ({ session: { did: "did:foo" } })),
      },
      idResolver: {
        did: {
          resolveAtprotoData: mock.fn(async () => ({ pds: "https://bsky.social" })),
        },
      },
      logger: {
        info: mock.fn(),
        error: mock.fn(),
        debug: mock.fn(),
        warn: mock.fn(),
      },
      ...overrides,
    };
  }

  function makeReq(overrides: any = {}): any {
    return {
      body: {},
      session: null,
      originalUrl: "/oauth/callback?code=abc&state=xyz",
      ...overrides,
    };
  }

  function makeRes(): any {
    const res: any = {};
    res.status = mock.fn(() => res);
    res.json = mock.fn(() => res);
    res.redirect = mock.fn(() => res);
    res.cookie = mock.fn(() => res);
    res.clearCookie = mock.fn(() => res);
    return res;
  }

  function makeService(overrides: any = {}): any {
    return {
      getOAuthRedirectUrl: mock.fn(async () => "https://bsky.app/oauth"),
      revokeSession: mock.fn(async () => {}),
      checkSession: mock.fn(async () => null),
      createOrConfirmUserProfile: mock.fn(async () => {}),
      encryptDid: mock.fn(() => "enc-token"),
      decryptDid: mock.fn(() => "did:foo"),
      findUserByDid: mock.fn(async () => ({ did: "did:foo" })),
      ...overrides,
    };
  }

  describe("login", () => {
    test("returns 400 for invalid handle (empty string)", async () => {
      const controller = new AuthController(makeCtx());
      const res = makeRes();
      await controller.login(makeReq({ body: { handle: "" } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
    });

    test("returns 400 for non-string handle", async () => {
      const controller = new AuthController(makeCtx());
      const res = makeRes();
      await controller.login(makeReq({ body: { handle: 123 } }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
    });

    test("returns 400 when body is undefined (req.body?.handle is undefined)", async () => {
      const controller = new AuthController(makeCtx());
      const res = makeRes();
      await controller.login(makeReq({ body: undefined }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
    });

    test("returns redirectUrl on success", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService();
      const res = makeRes();

      await controller.login(makeReq({ body: { handle: "foo.bsky.social" } }), res);

      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        redirectUrl: "https://bsky.app/oauth",
      });
    });

    test("returns 500 when service throws", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({
        getOAuthRedirectUrl: mock.fn(async () => {
          throw new Error("network");
        }),
      });
      const res = makeRes();

      await controller.login(makeReq({ body: { handle: "foo.bsky.social" } }), res);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });

    test("returns fallback error message when thrown error has empty message", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({
        getOAuthRedirectUrl: mock.fn(async () => {
          throw new Error("");
        }),
      });
      const res = makeRes();

      await controller.login(makeReq({ body: { handle: "foo.bsky.social" } }), res);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
      assert.strictEqual(res.json.mock.calls[0].arguments[0].error, "couldn't initiate login");
    });
  });

  describe("logout", () => {
    test("returns 400 when no session", async () => {
      const controller = new AuthController(makeCtx());
      const res = makeRes();
      await controller.logout(makeReq({ session: null }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
    });

    test("returns 200, clears session, and clears nf-region cookie on success", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService();
      const req = makeReq({ session: { did: "did:foo" } });
      const res = makeRes();

      await controller.logout(req, res);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
      assert.strictEqual(req.session, null);
      assert.strictEqual(res.clearCookie.mock.calls.length, 1);
      assert.strictEqual(res.clearCookie.mock.calls[0].arguments[0], "nf-region");
    });

    test("returns 500 when revokeSession throws", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({
        revokeSession: mock.fn(async () => {
          throw new Error("revoke failed");
        }),
      });
      const res = makeRes();

      await controller.logout(makeReq({ session: { did: "did:foo" } }), res);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });
  });

  describe("session", () => {
    test("returns isLoggedIn:false when no session DID", async () => {
      const controller = new AuthController(makeCtx());
      const res = makeRes();
      await controller.session(makeReq({ session: null }), res);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        isLoggedIn: false,
        profile: null,
        did: null,
      });
    });

    test("returns isLoggedIn:true when checkSession returns profile", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      const mockProfile = { did: "did:foo", handle: "foo.bsky.social" };
      (controller as any).service = makeService({
        checkSession: mock.fn(async () => mockProfile),
      });
      const res = makeRes();

      await controller.session(makeReq({ session: { did: "did:foo" } }), res);

      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        isLoggedIn: true,
        profile: mockProfile,
        did: "did:foo",
      });
    });

    test("returns isLoggedIn:false and clears session when checkSession returns null", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({ checkSession: mock.fn(async () => null) });
      const req = makeReq({ session: { did: "did:foo" } });
      const res = makeRes();

      await controller.session(req, res);

      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        isLoggedIn: false,
        profile: null,
        did: null,
      });
      assert.strictEqual(req.session, null);
    });

    test("returns isLoggedIn:false when checkSession throws", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({
        checkSession: mock.fn(async () => {
          throw new Error("session error");
        }),
      });
      const res = makeRes();

      await controller.session(makeReq({ session: { did: "did:foo" } }), res);

      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        isLoggedIn: false,
        profile: null,
        did: null,
      });
    });
  });

  describe("clientMetadata", () => {
    test("returns ctx.oauthClient.clientMetadata", () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      const res = makeRes();

      controller.clientMetadata(makeReq(), res);

      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { client_id: "test-client" });
    });
  });

  describe("oauthCallback", () => {
    test("redirects with token on callback success and profile created", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService();
      const req = makeReq({ session: {}, originalUrl: "/oauth/callback?code=abc&state=xyz" });
      const res = makeRes();

      await controller.oauthCallback(req, res);

      const redirectUrl: string = res.redirect.mock.calls[0].arguments[0];
      assert.ok(redirectUrl.includes("oauth_token=enc-token"));
      assert.deepStrictEqual(req.session, { did: "did:foo" });
    });

    test("still redirects with token when db profile creation throws", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({
        createOrConfirmUserProfile: mock.fn(async () => {
          throw new Error("db error");
        }),
      });
      const req = makeReq({ session: {}, originalUrl: "/oauth/callback?code=abc&state=xyz" });
      const res = makeRes();

      await controller.oauthCallback(req, res);

      const redirectUrl: string = res.redirect.mock.calls[0].arguments[0];
      assert.ok(redirectUrl.includes("oauth_token=enc-token"));
    });

    test("redirects with error=server_config when encryptDid throws", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({
        encryptDid: mock.fn(() => {
          throw new Error("no secret");
        }),
      });
      const req = makeReq({ session: {}, originalUrl: "/oauth/callback?code=abc&state=xyz" });
      const res = makeRes();

      await controller.oauthCallback(req, res);

      const redirectUrl: string = res.redirect.mock.calls[0].arguments[0];
      assert.ok(redirectUrl.includes("error=server_config"));
    });

    test("redirects with error=oauth_failed when callback throws", async () => {
      const ctx = makeCtx({
        oauthClient: {
          clientMetadata: { client_id: "test-client" },
          callback: mock.fn(async () => {
            throw new Error("oauth error");
          }),
        },
      });
      const controller = new AuthController(ctx);
      const req = makeReq({ session: {}, originalUrl: "/oauth/callback?code=abc&state=xyz" });
      const res = makeRes();

      await controller.oauthCallback(req, res);

      const redirectUrl: string = res.redirect.mock.calls[0].arguments[0];
      assert.ok(redirectUrl.includes("error=oauth_failed"));
    });

    test("redirects with error=oauth_failed when callback throws a non-Error value", async () => {
      const ctx = makeCtx({
        oauthClient: {
          clientMetadata: { client_id: "test-client" },
          callback: mock.fn(async () => {
            throw "oauth string error";
          }),
        },
      });
      const controller = new AuthController(ctx);
      const req = makeReq({ session: {}, originalUrl: "/oauth/callback?code=abc&state=xyz" });
      const res = makeRes();

      await controller.oauthCallback(req, res);

      const redirectUrl: string = res.redirect.mock.calls[0].arguments[0];
      assert.ok(redirectUrl.includes("error=oauth_failed"));
    });

    test("redirects with error=oauth_failed when callback throws Error with no stack", async () => {
      const errWithNoStack = new Error("no stack error");
      errWithNoStack.stack = "";
      const ctx = makeCtx({
        oauthClient: {
          clientMetadata: { client_id: "test-client" },
          callback: mock.fn(async () => {
            throw errWithNoStack;
          }),
        },
      });
      const controller = new AuthController(ctx);
      const req = makeReq({ session: {}, originalUrl: "/oauth/callback?code=abc&state=xyz" });
      const res = makeRes();

      await controller.oauthCallback(req, res);

      const redirectUrl: string = res.redirect.mock.calls[0].arguments[0];
      assert.ok(redirectUrl.includes("error=oauth_failed"));
    });
  });

  describe("oauthConsume", () => {
    test("returns 400 when oauth_token is missing", async () => {
      const controller = new AuthController(makeCtx());
      const res = makeRes();
      await controller.oauthConsume(makeReq({ body: {} }), res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
    });

    test("returns 500 when decryptDid throws", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({
        decryptDid: mock.fn(() => {
          throw new Error("bad secret");
        }),
      });
      const res = makeRes();

      await controller.oauthConsume(makeReq({ body: { oauth_token: "bad" } }), res);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    });

    test("returns 404 when user not found", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({
        findUserByDid: mock.fn(async () => null),
      });
      const res = makeRes();

      await controller.oauthConsume(makeReq({ body: { oauth_token: "token" } }), res);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
    });

    test("returns 200, sets session, and sets nf-region cookie based on PDS", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService();
      const req = makeReq({ body: { oauth_token: "token" }, session: {} });
      const res = makeRes();

      await controller.oauthConsume(req, res);

      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { success: true });
      assert.deepStrictEqual(req.session, { did: "did:foo" });
      assert.strictEqual(res.cookie.mock.calls.length, 1);
      assert.strictEqual(res.cookie.mock.calls[0].arguments[0], "nf-region");
      assert.strictEqual(res.cookie.mock.calls[0].arguments[1], "us");
    });

    test("returns 200 and sets eu cookie for non-bsky PDS", async () => {
      const ctx = makeCtx({
        idResolver: {
          did: {
            resolveAtprotoData: mock.fn(async () => ({ pds: "https://my-pds.example.com" })),
          },
        },
      });
      const controller = new AuthController(ctx);
      (controller as any).service = makeService();
      const req = makeReq({ body: { oauth_token: "token" }, session: {} });
      const res = makeRes();

      await controller.oauthConsume(req, res);

      assert.strictEqual(res.cookie.mock.calls[0].arguments[1], "eu");
    });

    test("returns 200 even when PDS resolution fails", async () => {
      const ctx = makeCtx({
        idResolver: {
          did: {
            resolveAtprotoData: mock.fn(async () => {
              throw new Error("dns failure");
            }),
          },
        },
      });
      const controller = new AuthController(ctx);
      (controller as any).service = makeService();
      const req = makeReq({ body: { oauth_token: "token" }, session: {} });
      const res = makeRes();

      await controller.oauthConsume(req, res);

      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { success: true });
      assert.strictEqual(res.cookie.mock.calls.length, 0);
    });

    test("returns 400 when findUserByDid throws", async () => {
      const ctx = makeCtx();
      const controller = new AuthController(ctx);
      (controller as any).service = makeService({
        findUserByDid: mock.fn(async () => {
          throw new Error("db error");
        }),
      });
      const res = makeRes();

      await controller.oauthConsume(makeReq({ body: { oauth_token: "token" } }), res);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
    });
  });
});
