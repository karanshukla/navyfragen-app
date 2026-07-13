import assert from "node:assert";
import { test, describe, before, beforeEach, afterEach, mock } from "node:test";

import { OAuthResolverError } from "@atproto/oauth-client-node";

import { deleteE2EAgent, getE2EAgent, setE2EAgent } from "../auth/e2e-agent-store";

// `mock.module` must be registered before the module under test is imported so
// that auth-service's transitive import of session-agent picks up the mock.
// AuthService is therefore loaded lazily in `before()` and held in this `let`.
//
// The mock faithfully reproduces the real `initializeAgentForDid` branching
// (e2e agent > null-on-restore-miss > fake agent) so the existing E2E/no-agent
// tests keep working; only the `new Agent(session)` leaf is replaced with
// `mockAgent`, whose `getProfile` tests reassign to exercise the previously
// untestable getProfile block in checkSession.
let AuthService: typeof import("../services/auth-service").AuthService;
let mockAgent: { getProfile: (...args: any[]) => Promise<any> };

before(async () => {
  mockAgent = { getProfile: mock.fn(async () => ({ data: undefined })) };
  await mock.module("../auth/session-agent", {
    exports: {
      // Mirror the real contract: e2e bypass first, then null on restore-miss,
      // otherwise hand back the controllable fake agent.
      initializeAgentForDid: async (ctx: any, did: string) => {
        const e2e = getE2EAgent(did);
        if (e2e) return e2e;
        const restored = await ctx.oauthClient.restore(did);
        if (!restored) return null;
        return mockAgent;
      },
      initializeAgentFromSession: async (req: any, ctx: any) => {
        if (!req.session?.did) return null;
        const { initializeAgentForDid } = await import("../auth/session-agent");
        return initializeAgentForDid(ctx, req.session.did);
      },
    },
  });
  const mod = await import("../services/auth-service");
  AuthService = mod.AuthService;
});

describe("AuthService", () => {
  let ctx: any;
  let service: InstanceType<typeof AuthService>;

  function makeMockCtx(overrides: any = {}) {
    return {
      oauthClient: {
        authorize: mock.fn(async () => new URL("https://example.com/redirect")),
        revoke: mock.fn(async () => {}),
        callback: mock.fn(async () => ({ session: { did: "did:foo" } })),
        clientMetadata: { foo: "bar" },
      },
      db: {
        deleteFrom: mock.fn(() => ({
          where: mock.fn(function (this: any) {
            return this as any;
          }),
          execute: mock.fn(async () => ({})),
        })),
      },
      logger: {
        error: mock.fn(),
        warn: mock.fn(),
        info: mock.fn(),
        debug: mock.fn(),
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    ctx = makeMockCtx();
    process.env.OAUTH_TOKEN_SECRET = "testsecret";
    service = new AuthService(ctx);
  });

  test("getOAuthRedirectUrl throws for invalid handle", async () => {
    await assert.rejects(() => service.getOAuthRedirectUrl(""), /invalid handle/);
  });

  test("getOAuthRedirectUrl returns URL for valid handle", async () => {
    const url = await service.getOAuthRedirectUrl("test.bsky.social");
    assert.strictEqual(url, "https://example.com/redirect");
  });

  test("getOAuthRedirectUrl re-throws OAuthResolverError message", async () => {
    ctx.oauthClient.authorize = mock.fn(async () => {
      throw new OAuthResolverError("handle not found");
    });
    await assert.rejects(
      () => service.getOAuthRedirectUrl("unknown.bsky.social"),
      /handle not found/
    );
  });

  test("getOAuthRedirectUrl throws generic error for non-OAuthResolverError", async () => {
    ctx.oauthClient.authorize = mock.fn(async () => {
      throw new Error("unexpected");
    });
    await assert.rejects(
      () => service.getOAuthRedirectUrl("test.bsky.social"),
      /couldn't initiate login/
    );
  });

  test("decryptDid returns original DID", () => {
    const did = "did:plc:xyz123";
    const encrypted = service.encryptDid(did);
    const decoded = decodeURIComponent(encrypted);
    const decrypted = service.decryptDid(decoded);
    assert.strictEqual(decrypted, did);
  });

  test("revokeSession calls oauthClient.revoke", async () => {
    await service.revokeSession("did:foo");
    assert.strictEqual(ctx.oauthClient.revoke.mock.calls.length, 1);
  });

  describe("revokeSession with an E2E agent", () => {
    afterEach(() => {
      deleteE2EAgent("did:e2e");
    });

    test("deletes the E2E agent and auth session instead of calling oauthClient.revoke", async () => {
      setE2EAgent("did:e2e", {} as any, "e2e-user.bsky.social");
      await service.revokeSession("did:e2e");
      assert.strictEqual(ctx.oauthClient.revoke.mock.calls.length, 0);
      assert.strictEqual(ctx.db.deleteFrom.mock.calls.length, 1);
      assert.strictEqual(ctx.db.deleteFrom.mock.calls[0].arguments[0], "auth_session");
    });
  });

  test("encryptDid and decryptDid roundtrip", () => {
    const token = service.encryptDid("did:foo");
    const did = service.decryptDid(decodeURIComponent(token));
    assert.strictEqual(did, "did:foo");
  });

  test("findUserByDid returns user", async () => {
    ctx.db.selectFrom = mock.fn(() => ({
      selectAll: mock.fn(function (this: any) {
        return this as any;
      }),
      where: mock.fn(function (this: any) {
        return this as any;
      }),
      executeTakeFirst: mock.fn(async () => ({ did: "did:foo" })),
    }));
    const user = await service.findUserByDid("did:foo");
    assert.deepStrictEqual(user, { did: "did:foo" });
  });

  describe("checkSession", () => {
    test("returns null when no db session exists", async () => {
      ctx.db.selectFrom = mock.fn(() => ({
        selectAll: mock.fn(function (this: any) {
          return this as any;
        }),
        where: mock.fn(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock.fn(async () => undefined),
      }));
      const result = await service.checkSession("did:foo");
      assert.strictEqual(result, null);
    });

    test("returns null when oauthClient.restore returns null (no agent)", async () => {
      ctx.db.selectFrom = mock.fn(() => ({
        selectAll: mock.fn(function (this: any) {
          return this as any;
        }),
        where: mock.fn(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock.fn(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock.fn(async () => null);
      const result = await service.checkSession("did:foo");
      assert.strictEqual(result, null);
    });

    test("returns the mapped profile when getProfile resolves with data", async () => {
      ctx.db.selectFrom = mock.fn(() => ({
        selectAll: mock.fn(function (this: any) {
          return this as any;
        }),
        where: mock.fn(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock.fn(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock.fn(async () => ({ sub: "did:foo" }));
      mockAgent.getProfile = mock.fn(async () => ({
        data: {
          did: "did:foo",
          handle: "foo.bsky.social",
          displayName: "Foo",
          description: "a bio",
          avatar: "https://example.com/a.png",
          banner: "https://example.com/b.png",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      }));
      const result = await service.checkSession("did:foo");
      assert.deepStrictEqual(result, {
        did: "did:foo",
        handle: "foo.bsky.social",
        displayName: "Foo",
        description: "a bio",
        avatar: "https://example.com/a.png",
        banner: "https://example.com/b.png",
        createdAt: "2024-01-01T00:00:00.000Z",
      });
      assert.deepStrictEqual(mockAgent.getProfile.mock.calls[0].arguments[0], {
        actor: "did:foo",
      });
    });

    test("coerces absent optional profile fields to empty string / undefined", async () => {
      ctx.db.selectFrom = mock.fn(() => ({
        selectAll: mock.fn(function (this: any) {
          return this as any;
        }),
        where: mock.fn(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock.fn(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock.fn(async () => ({ sub: "did:foo" }));
      mockAgent.getProfile = mock.fn(async () => ({
        data: {
          did: "did:foo",
          handle: "foo.bsky.social",
          displayName: undefined,
          description: undefined,
          avatar: undefined,
          banner: undefined,
          createdAt: undefined,
        },
      }));
      const result = await service.checkSession("did:foo");
      assert.deepStrictEqual(result, {
        did: "did:foo",
        handle: "foo.bsky.social",
        displayName: "",
        description: "",
        avatar: undefined,
        banner: undefined,
        createdAt: undefined,
      });
    });

    test("returns null when getProfile resolves but data is falsy", async () => {
      ctx.db.selectFrom = mock.fn(() => ({
        selectAll: mock.fn(function (this: any) {
          return this as any;
        }),
        where: mock.fn(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock.fn(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock.fn(async () => ({ sub: "did:foo" }));
      mockAgent.getProfile = mock.fn(async () => ({ data: null }));
      const result = await service.checkSession("did:foo");
      assert.strictEqual(result, null);
    });

    test("rethrows when getProfile rejects", async () => {
      ctx.db.selectFrom = mock.fn(() => ({
        selectAll: mock.fn(function (this: any) {
          return this as any;
        }),
        where: mock.fn(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock.fn(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock.fn(async () => ({ sub: "did:foo" }));
      mockAgent.getProfile = mock.fn(async () => {
        throw new Error("network down");
      });
      await assert.rejects(() => service.checkSession("did:foo"), /network down/);
    });

    describe("with an E2E agent", () => {
      afterEach(() => {
        deleteE2EAgent("did:e2e");
      });

      test("returns a synthetic profile built from the stored E2E handle", async () => {
        ctx.db.selectFrom = mock.fn(() => ({
          selectAll: mock.fn(function (this: any) {
            return this as any;
          }),
          where: mock.fn(function (this: any) {
            return this as any;
          }),
          executeTakeFirst: mock.fn(async () => ({ key: "did:e2e" })),
        }));
        setE2EAgent("did:e2e", {} as any, "e2e-user.bsky.social");

        const result = await service.checkSession("did:e2e");

        assert.deepStrictEqual(result, {
          did: "did:e2e",
          handle: "e2e-user.bsky.social",
          displayName: "e2e-user.bsky.social",
          description: "",
          avatar: undefined,
          banner: undefined,
          createdAt: undefined,
        });
      });

      test("falls back to the did as the handle when no E2E handle was stored", async () => {
        ctx.db.selectFrom = mock.fn(() => ({
          selectAll: mock.fn(function (this: any) {
            return this as any;
          }),
          where: mock.fn(function (this: any) {
            return this as any;
          }),
          executeTakeFirst: mock.fn(async () => ({ key: "did:e2e" })),
        }));
        setE2EAgent("did:e2e", {} as any, "");

        const result = await service.checkSession("did:e2e");

        assert.strictEqual(result?.handle, "did:e2e");
      });
    });
  });

  describe("createOrConfirmUserProfile", () => {
    test("calls insertInto user_profile with did and createdAt", async () => {
      const executesMock = mock.fn(async () => ({}));
      const onConflictMock = mock.fn(function (this: any, cb?: (oc: any) => any) {
        if (typeof cb === "function") {
          const oc = { column: (_col: string) => ({ doNothing: () => this }) };
          cb(oc);
        }
        return this as any;
      });
      const valuesMock = mock.fn(function (this: any) {
        (this as any).execute = executesMock;
        (this as any).onConflict = onConflictMock;
        return this as any;
      });
      ctx.db.insertInto = mock.fn(() => ({
        values: valuesMock,
        onConflict: onConflictMock,
        execute: executesMock,
      }));

      await service.createOrConfirmUserProfile("did:foo");

      assert.strictEqual(ctx.db.insertInto.mock.calls[0].arguments[0], "user_profile");
      const valuesArg = valuesMock.mock.calls[0].arguments[0];
      assert.strictEqual(valuesArg.did, "did:foo");
      assert.ok(typeof valuesArg.createdAt === "string");
    });
  });

  describe("getOAuthRedirectUrl with non-Error thrown", () => {
    test("covers err?.message and err?.stack optional chains when err is null", async () => {
      ctx.oauthClient.authorize = mock.fn(async () => {
        throw null;
      });
      await assert.rejects(
        () => service.getOAuthRedirectUrl("test.bsky.social"),
        /couldn't initiate login/
      );
      assert.strictEqual(ctx.logger.error.mock.calls.length, 1);
    });

    test("covers err?.message when err is a plain string", async () => {
      ctx.oauthClient.authorize = mock.fn(async () => {
        throw "authorize failed";
      });
      await assert.rejects(
        () => service.getOAuthRedirectUrl("test.bsky.social"),
        /couldn't initiate login/
      );
    });
  });
});
