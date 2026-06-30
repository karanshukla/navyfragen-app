import assert from "node:assert";
import { test, describe, beforeEach, mock } from "node:test";

import { OAuthResolverError } from "@atproto/oauth-client-node";

import { AuthService } from "../services/auth-service";

describe("AuthService", () => {
  let ctx: any;
  let service: AuthService;

  function makeMockCtx(overrides: any = {}) {
    return {
      oauthClient: {
        authorize: mock.fn(async () => new URL("https://example.com/redirect")),
        revoke: mock.fn(async () => {}),
        callback: mock.fn(async () => ({ session: { did: "did:foo" } })),
        clientMetadata: { foo: "bar" },
      },
      db: {
        selectFrom: mock.fn(() => ({
          selectAll: mock.fn(function (this: any) {
            return this as any;
          }),
          where: mock.fn(function (this: any) {
            return this as any;
          }),
          executeTakeFirst: mock.fn(async () => ({ key: "did:foo" })),
        })),
        insertInto: mock.fn(() => ({
          values: mock.fn(function (this: any) {
            return this as any;
          }),
          onConflict: mock.fn(function (this: any) {
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

    test("throws when agent exists but getProfile call fails (covers !agent=false branch)", async () => {
      ctx.db.selectFrom = mock.fn(() => ({
        selectAll: mock.fn(function (this: any) {
          return this as any;
        }),
        where: mock.fn(function (this: any) {
          return this as any;
        }),
        executeTakeFirst: mock.fn(async () => ({ key: "did:foo" })),
      }));
      // Restore returns a non-null object so initializeAgentForDid creates a real Agent
      ctx.oauthClient.restore = mock.fn(async () => ({ sub: "did:foo" }));
      // The real Agent has no valid network session so getProfile will throw
      await assert.rejects(() => service.checkSession("did:foo"), /.+/);
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
