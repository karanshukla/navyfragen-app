import { AuthService } from "../services/auth-service";
import { test, describe, beforeEach, mock } from "node:test";
import assert from "node:assert";

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
      ...overrides,
    };
  }

  beforeEach(() => {
    ctx = makeMockCtx();
    process.env.OAUTH_TOKEN_SECRET = "testsecret";
    service = new AuthService(ctx);
  });

  test("getOAuthRedirectUrl throws for invalid handle", async () => {
    await assert.rejects(
      () => service.getOAuthRedirectUrl(""),
      /invalid handle/
    );
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
});
