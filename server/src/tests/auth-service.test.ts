import assert from "node:assert";
import { test, describe, beforeAll, afterAll, beforeEach, afterEach, mock } from "bun:test";

import { OAuthResolverError } from "@atproto/oauth-client-node";

import { deleteE2EAgent, setE2EAgent } from "../auth/e2e-agent-store";

// `mock.module` must be registered before the module under test is imported so
// that auth-service's transitive import of session-agent picks up the mock.
// AuthService is therefore loaded lazily in `before()` and held in this `let`.
//
// checkSession and revokeSession both check hasE2EAgent() themselves before
// ever calling initializeAgentForDid, so the mock only needs to reproduce the
// null-on-restore-miss / fake-agent branching; the `new Agent(session)` leaf
// is replaced with `mockAgent`, whose `getProfile` tests reassign to exercise
// the previously untestable getProfile block in checkSession.
let AuthService: typeof import("../services/auth-service").AuthService;
let mockAgent: { getProfile: (...args: any[]) => Promise<any> };

beforeAll(async () => {
  mockAgent = { getProfile: mock(async () => ({ data: undefined })) };
  // Spread the real module so every export it has keeps working and only
  // initializeAgentForDid is swapped. Bun's `mock.module` is process-global and
  // not restorable (`clearAllMocks` clears mock call history but does not unmock
  // modules), so `--isolate` (passed in the package script) gives each test
  // file a fresh module registry. Do not let `--isolate` be the only thing
  // keeping this mock contained: spreading the real binding means a partial
  // mock can't take out files that import the real initializeAgentForDid
  // (e.g. session-agent.test.ts) with a missing-export SyntaxError. Re-exporting
  // the real binding costs no coverage — it is the same function session-agent
  // .test.ts already exercises.
  const realSessionAgent = await import("../auth/session-agent");
  mock.module("../auth/session-agent", () => ({
    ...realSessionAgent,
    initializeAgentForDid: async (ctx: any, did: string) => {
      const restored = await ctx.oauthClient.restore(did);
      if (!restored) return null;
      return mockAgent;
    },
  }));
  const mod = await import("../services/auth-service");
  AuthService = mod.AuthService;
});

// Drop the mock() call history. Bun's `clearAllMocks` does not unmock modules
// (the session-agent mock above stays registered for the process), but
// `--isolate` gives each test file its own module registry so the mock never
// leaks into other files regardless. This is call-history cleanup, not the
// thing keeping the session-agent mock contained.
afterAll(() => {
  mock.clearAllMocks();
});

describe("AuthService", () => {
  let ctx: any;
  let service: InstanceType<typeof AuthService>;

  function makeMockCtx(overrides: any = {}) {
    return {
      oauthClient: {
        authorize: mock(async () => new URL("https://example.com/redirect")),
        revoke: mock(async () => {}),
        callback: mock(async () => ({ session: { did: "did:foo" } })),
        clientMetadata: { foo: "bar" },
      },
      db: {
        deleteFrom: mock(() => ({
          where: mock(function (this: any) {
            return this as any;
          }),
          execute: mock(async () => ({})),
        })),
      },
      logger: {
        error: mock(),
        warn: mock(),
        info: mock(),
        debug: mock(),
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
    ctx.oauthClient.authorize = mock(async () => {
      throw new OAuthResolverError("handle not found");
    });
    await assert.rejects(
      () => service.getOAuthRedirectUrl("unknown.bsky.social"),
      /handle not found/
    );
  });

  test("getOAuthRedirectUrl throws generic error for non-OAuthResolverError", async () => {
    ctx.oauthClient.authorize = mock(async () => {
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
      assert.strictEqual(ctx.db.deleteFrom.mock.calls[0][0], "auth_session");
    });
  });

  test("encryptDid and decryptDid roundtrip", () => {
    const token = service.encryptDid("did:foo");
    const did = service.decryptDid(decodeURIComponent(token));
    assert.strictEqual(did, "did:foo");
  });

  test("findUserByDid returns user", async () => {
    ctx.db.selectFrom = mock(() => ({
      selectAll: mock(function (this: any) {
        return this as any;
      }),
      where: mock(function (this: any) {
        return this as any;
      }),
      executeTakeFirst: mock(async () => ({ did: "did:foo" })),
    }));
    const user = await service.findUserByDid("did:foo");
    assert.deepStrictEqual(user, { did: "did:foo" });
  });

  describe("checkSession", () => {
    test("returns null when no db session exists", async () => {
      ctx.db.selectFrom = mock(() => ({
        selectAll: mock(function (this: any) {
          return this as any;
        }),
        where: mock(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock(async () => undefined),
      }));
      const result = await service.checkSession("did:foo");
      assert.strictEqual(result, null);
    });

    test("returns null when oauthClient.restore returns null (no agent)", async () => {
      ctx.db.selectFrom = mock(() => ({
        selectAll: mock(function (this: any) {
          return this as any;
        }),
        where: mock(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock(async () => null);
      const result = await service.checkSession("did:foo");
      assert.strictEqual(result, null);
    });

    test("returns the mapped profile when getProfile resolves with data", async () => {
      ctx.db.selectFrom = mock(() => ({
        selectAll: mock(function (this: any) {
          return this as any;
        }),
        where: mock(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock(async () => ({ sub: "did:foo" }));
      mockAgent.getProfile = mock(async () => ({
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
      assert.deepStrictEqual(mockAgent.getProfile.mock.calls[0][0], {
        actor: "did:foo",
      });
    });

    test("coerces absent optional profile fields to empty string / undefined", async () => {
      ctx.db.selectFrom = mock(() => ({
        selectAll: mock(function (this: any) {
          return this as any;
        }),
        where: mock(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock(async () => ({ sub: "did:foo" }));
      mockAgent.getProfile = mock(async () => ({
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
      ctx.db.selectFrom = mock(() => ({
        selectAll: mock(function (this: any) {
          return this as any;
        }),
        where: mock(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock(async () => ({ sub: "did:foo" }));
      mockAgent.getProfile = mock(async () => ({ data: null }));
      const result = await service.checkSession("did:foo");
      assert.strictEqual(result, null);
    });

    test("rethrows when getProfile rejects", async () => {
      ctx.db.selectFrom = mock(() => ({
        selectAll: mock(function (this: any) {
          return this as any;
        }),
        where: mock(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock(async () => ({ key: "did:foo" })),
      }));
      ctx.oauthClient.restore = mock(async () => ({ sub: "did:foo" }));
      mockAgent.getProfile = mock(async () => {
        throw new Error("network down");
      });
      await assert.rejects(() => service.checkSession("did:foo"), /network down/);
    });

    describe("with an E2E agent", () => {
      afterEach(() => {
        deleteE2EAgent("did:e2e");
      });

      test("returns a synthetic profile built from the stored E2E handle", async () => {
        ctx.db.selectFrom = mock(() => ({
          selectAll: mock(function (this: any) {
            return this as any;
          }),
          where: mock(function (this: any) {
            return this as any;
          }),
          executeTakeFirst: mock(async () => ({ key: "did:e2e" })),
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
        ctx.db.selectFrom = mock(() => ({
          selectAll: mock(function (this: any) {
            return this as any;
          }),
          where: mock(function (this: any) {
            return this as any;
          }),
          executeTakeFirst: mock(async () => ({ key: "did:e2e" })),
        }));
        setE2EAgent("did:e2e", {} as any, "");

        const result = await service.checkSession("did:e2e");

        assert.strictEqual(result?.handle, "did:e2e");
      });
    });
  });

  describe("createOrConfirmUserProfile", () => {
    test("calls insertInto user_profile with did and createdAt", async () => {
      const executesMock = mock(async () => ({}));
      const onConflictMock = mock(function (this: any, cb?: (oc: any) => any) {
        if (typeof cb === "function") {
          const oc = { column: (_col: string) => ({ doNothing: () => this }) };
          cb(oc);
        }
        return this as any;
      });
      const valuesMock = mock(function (this: any) {
        (this as any).execute = executesMock;
        (this as any).onConflict = onConflictMock;
        return this as any;
      });
      ctx.db.insertInto = mock(() => ({
        values: valuesMock,
        onConflict: onConflictMock,
        execute: executesMock,
      }));

      await service.createOrConfirmUserProfile("did:foo");

      assert.strictEqual(ctx.db.insertInto.mock.calls[0][0], "user_profile");
      const valuesArg = valuesMock.mock.calls[0][0];
      assert.strictEqual(valuesArg.did, "did:foo");
      assert.ok(typeof valuesArg.createdAt === "string");
    });
  });

  describe("getOAuthRedirectUrl with non-Error thrown", () => {
    test("covers err?.message and err?.stack optional chains when err is null", async () => {
      ctx.oauthClient.authorize = mock(async () => {
        throw null;
      });
      await assert.rejects(
        () => service.getOAuthRedirectUrl("test.bsky.social"),
        /couldn't initiate login/
      );
      assert.strictEqual(ctx.logger.error.mock.calls.length, 1);
    });

    test("covers err?.message when err is a plain string", async () => {
      ctx.oauthClient.authorize = mock(async () => {
        throw "authorize failed";
      });
      await assert.rejects(
        () => service.getOAuthRedirectUrl("test.bsky.social"),
        /couldn't initiate login/
      );
    });
  });
});
