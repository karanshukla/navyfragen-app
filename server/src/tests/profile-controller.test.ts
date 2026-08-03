import assert from "node:assert";
import { test, describe, afterEach, mock } from "bun:test";

import { createProfileHono, type ProfileDeps } from "#/hono/message-routes";
import { withTestSession, sessionHeader } from "./helpers/hono-test";

import type { AppContext } from "#/index";
import type { AppSessionData } from "#/auth/session";

describe("Profile (Hono)", () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  function makeCtx(overrides: any = {}): AppContext {
    return {
      db: {} as any,
      oauthClient: {
        restore: mock(async () => ({ sub: "did:foo" })),
      } as any,
      resolver: {
        resolveHandleToDid: mock(async () => "did:foo"),
      } as any,
      idResolver: {
        did: {
          resolveAtprotoData: mock(async () => ({ pds: "https://pds.example.com" })),
        },
      } as any,
      logger: { info: mock(), error: mock(), warn: mock(), debug: mock() } as any,
      ...overrides,
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

  function makeApp(
    opts: { ctxOverrides?: any; serviceOverride?: any; session?: AppSessionData | null } = {}
  ) {
    const ctx = makeCtx(opts.ctxOverrides);
    const service = makeService(opts.serviceOverride);
    const app = withTestSession(createProfileHono(ctx, { profileService: service } as ProfileDeps));
    return { app, service, ctx, headers: sessionHeader(opts.session ?? { did: "did:foo" }) };
  }

  describe("GET /public-profile/:did", () => {
    test("returns profile on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/public-profile/did:foo", { headers });
      assert.strictEqual(res.status, 200);
    });

    test("returns 404 when service throws 'Profile not found'", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getPublicProfile: mock(async () => {
            throw new Error("Profile not found");
          }),
        },
      });
      const res = await app.request("/public-profile/did:foo", { headers });
      assert.strictEqual(res.status, 404);
    });

    test("returns 500 on other error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getPublicProfile: mock(async () => {
            throw new Error("db error");
          }),
        },
      });
      const res = await app.request("/public-profile/did:foo", { headers });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("GET /user-exists/:did", () => {
    test("returns exists result on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/user-exists/did:foo", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { exists: true, did: "did:foo" });
    });

    test("returns 500 on error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          checkUserExists: mock(async () => {
            throw new Error("db error");
          }),
        },
      });
      const res = await app.request("/user-exists/did:foo", { headers });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("GET /friends", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/friends", { headers: sessionHeader(null) });
      assert.strictEqual(res.status, 403);
    });

    test("returns moots, following, and oomfs on success", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getFriendsOnApp: mock(async () => ({
            moots: [{ did: "did:bar" }],
            following: [],
            oomfs: [],
          })),
        },
      });
      const res = await app.request("/friends", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, {
        moots: [{ did: "did:bar" }],
        following: [],
        oomfs: [],
      });
    });

    test("returns 500 on error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getFriendsOnApp: mock(async () => {
            throw new Error("err");
          }),
        },
      });
      const res = await app.request("/friends", { headers });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("GET /check-bot-follow", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/check-bot-follow", { headers: sessionHeader(null) });
      assert.strictEqual(res.status, 403);
    });

    test("returns 401 when agent is null", async () => {
      const { app, headers } = makeApp({
        ctxOverrides: { oauthClient: { restore: mock(async () => null) } },
      });
      const res = await app.request("/check-bot-follow", { headers });
      assert.strictEqual(res.status, 401);
    });

    test("returns following status on success", async () => {
      const { app, headers } = makeApp({
        serviceOverride: { checkFollowsBot: mock(async () => true) },
      });
      const res = await app.request("/check-bot-follow", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { following: true });
    });

    test("returns 500 on error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          checkFollowsBot: mock(async () => {
            throw new Error("err");
          }),
        },
      });
      const res = await app.request("/check-bot-follow", { headers });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("GET /handle-pds/:handle", () => {
    test("returns the PDS hostname on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/handle-pds/foo.bsky.social", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { pds: "pds.example.com" });
    });

    test("returns 404 when the handle does not resolve to a DID", async () => {
      const { app, headers } = makeApp({
        ctxOverrides: { resolver: { resolveHandleToDid: mock(async () => undefined) } },
      });
      const res = await app.request("/handle-pds/nobody.bsky.social", { headers });
      assert.strictEqual(res.status, 404);
    });

    test("returns 500 when PDS resolution throws", async () => {
      const { app, ctx, headers } = makeApp({
        ctxOverrides: {
          idResolver: {
            did: {
              resolveAtprotoData: mock(async () => {
                throw new Error("network error");
              }),
            },
          },
        },
      });
      const res = await app.request("/handle-pds/foo.bsky.social", { headers });
      assert.strictEqual(res.status, 500);
      assert.strictEqual((ctx.logger.error as any).mock.calls.length, 1);
    });
  });

  describe("GET /handle-search", () => {
    test("returns matching actors on success", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          searchActorsTypeahead: mock(async () => [{ did: "did:foo", handle: "foo.bsky.social" }]),
        },
      });
      const res = await app.request("/handle-search?q=foo", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, {
        actors: [{ did: "did:foo", handle: "foo.bsky.social" }],
      });
    });

    test("returns 500 when the search fails", async () => {
      const { app, ctx, headers } = makeApp({
        serviceOverride: {
          searchActorsTypeahead: mock(async () => {
            throw new Error("search failed");
          }),
        },
      });
      const res = await app.request("/handle-search?q=foo", { headers });
      assert.strictEqual(res.status, 500);
      assert.strictEqual((ctx.logger.error as any).mock.calls.length, 1);
    });
  });

  describe("GET /resolve-handle/:handle", () => {
    test("returns DID on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/resolve-handle/foo.bsky.social", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { did: "did:foo" });
    });

    test("returns 404 when service throws 'Handle not found'", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          resolveHandleToDid: mock(async () => {
            throw new Error("Handle not found");
          }),
        },
      });
      const res = await app.request("/resolve-handle/nobody.bsky.social", { headers });
      assert.strictEqual(res.status, 404);
    });

    test("returns 500 on other error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          resolveHandleToDid: mock(async () => {
            throw new Error("network");
          }),
        },
      });
      const res = await app.request("/resolve-handle/foo.bsky.social", { headers });
      assert.strictEqual(res.status, 500);
    });
  });
});
