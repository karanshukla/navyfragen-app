import assert from "node:assert";
import { test, describe, afterEach, mock } from "bun:test";

import { createAuthHono, type AuthDeps } from "#/hono/auth-routes";
import { withTestSession, sessionHeader } from "./helpers/hono-test";

import type { AppContext } from "#/index";
import type { AppSessionData } from "#/auth/session";
import type { AuthService } from "#/services/auth-service";

describe("Auth (Hono)", () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  function makeCtx(overrides: any = {}): AppContext {
    return {
      db: {} as any,
      oauthClient: {
        clientMetadata: { client_id: "test-client" },
        callback: mock(async () => ({ session: { did: "did:foo" } })),
      } as any,
      idResolver: {
        did: {
          resolveAtprotoData: mock(async () => ({ pds: "https://bsky.social" })),
        },
      } as any,
      resolver: {} as any,
      logger: { info: mock(), error: mock(), debug: mock(), warn: mock() } as any,
      ...overrides,
    };
  }

  function makeService(overrides: any = {}) {
    const mocks = {
      getOAuthRedirectUrl: mock(async () => "https://bsky.app/oauth"),
      revokeSession: mock(async (_did: string) => {}),
      checkSession: mock(async () => null),
      createOrConfirmUserProfile: mock(async () => {}),
      encryptDid: mock(() => "enc-token"),
      decryptDid: mock(() => "did:foo"),
      findUserByDid: mock(async () => ({ did: "did:foo" })),
    };
    return Object.assign(mocks, overrides) as unknown as typeof mocks & AuthService;
  }

  function makeNotificationService(overrides: any = {}): any {
    return {
      syncSubscriptionsAcrossAccounts: mock(async () => {}),
      ...overrides,
    };
  }

  function makeApp(
    opts: {
      ctxOverrides?: any;
      serviceOverride?: any;
      notificationOverride?: any;
      session?: AppSessionData | null;
    } = {}
  ) {
    const ctx = makeCtx(opts.ctxOverrides);
    const service = makeService(opts.serviceOverride);
    const notifications = makeNotificationService(opts.notificationOverride);
    const app = withTestSession(
      createAuthHono(ctx, { service, notificationService: notifications } as AuthDeps)
    );
    return { app, service, notifications, ctx, headers: sessionHeader(opts.session ?? null) };
  }

  const jsonHeaders = (h: Record<string, string>) => ({ ...h, "Content-Type": "application/json" });

  describe("POST /login", () => {
    test("returns 400 for empty handle", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/login", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ handle: "" }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.errors[0].message, "INVALID_HANDLE");
    });

    test("returns 400 for missing handle", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/login", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
    });

    test("returns 400 for a handle that passes Zod but fails isValidHandle", async () => {
      // "invalid_handle" has an underscore (not a valid AT Protocol char) but
      // satisfies the Zod min(1).max(64) schema — exercises the defense-in-depth
      // isValidHandle guard.
      const { app, headers } = makeApp();
      const res = await app.request("/login", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ handle: "invalid_handle" }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, "INVALID_HANDLE");
      assert.strictEqual(body.message, "invalid handle");
    });

    test("returns redirectUrl on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/login", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ handle: "foo.bsky.social" }),
      });
      const body = await res.json();
      assert.deepStrictEqual(body, { redirectUrl: "https://bsky.app/oauth" });
    });

    test("returns 500 when service throws", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getOAuthRedirectUrl: mock(async () => {
            throw new Error("network");
          }),
        },
      });
      const res = await app.request("/login", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ handle: "foo.bsky.social" }),
      });
      assert.strictEqual(res.status, 500);
    });

    test("returns fallback error message when thrown error has empty message", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getOAuthRedirectUrl: mock(async () => {
            throw new Error("");
          }),
        },
      });
      const res = await app.request("/login", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ handle: "foo.bsky.social" }),
      });
      assert.strictEqual(res.status, 500);
      const body = await res.json();
      assert.strictEqual(body.error, "couldn't initiate login");
    });
  });

  describe("POST /logout", () => {
    test("returns 400 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/logout", {
        method: "POST",
        headers: sessionHeader(null),
      });
      assert.strictEqual(res.status, 400);
    });

    test("returns 200 and clears session on success (single account)", async () => {
      const { app, service, headers } = makeApp({ session: { did: "did:foo" } });
      const res = await app.request("/logout", { method: "POST", headers });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body, { message: "Logged out successfully" });
      // revokeSession was called for the logged-out DID.
      assert.strictEqual(service.revokeSession.mock.calls.length, 1);
      assert.strictEqual(service.revokeSession.mock.calls[0][0], "did:foo");
    });

    test("switches to a remaining account instead of ending the session (multi-account)", async () => {
      const { app, headers } = makeApp({
        session: {
          did: "did:plc:foo",
          accounts: [
            { did: "did:plc:foo", handle: "foo.bsky.social" },
            { did: "did:plc:bar", handle: "bar.bsky.social" },
          ],
        },
      });
      const res = await app.request("/logout", { method: "POST", headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { message: "Logged out, switched account", switched: true });
    });

    test("returns 500 when revokeSession throws", async () => {
      const { app, headers } = makeApp({
        session: { did: "did:foo" },
        serviceOverride: {
          revokeSession: mock(async () => {
            throw new Error("revoke failed");
          }),
        },
      });
      const res = await app.request("/logout", { method: "POST", headers });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("GET /session", () => {
    test("returns isLoggedIn:false when no session DID", async () => {
      const { app, headers } = makeApp({ session: null });
      const res = await app.request("/session", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { isLoggedIn: false, profile: null, did: null });
    });

    test("returns isLoggedIn:true when checkSession returns profile", async () => {
      const mockProfile = { did: "did:foo", handle: "foo.bsky.social" };
      const { app, headers } = makeApp({
        session: { did: "did:foo" },
        serviceOverride: { checkSession: mock(async () => mockProfile) },
      });
      const res = await app.request("/session", { headers });
      const body = await res.json();
      assert.strictEqual(body.isLoggedIn, true);
      assert.deepStrictEqual(body.profile, mockProfile);
      assert.strictEqual(body.did, "did:foo");
    });

    test("returns isLoggedIn:false when checkSession returns null", async () => {
      const { app, headers } = makeApp({ session: { did: "did:foo" } });
      const res = await app.request("/session", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { isLoggedIn: false, profile: null, did: null });
    });

    test("falls back to another remembered account when active one is invalid", async () => {
      let call = 0;
      const { app, headers } = makeApp({
        session: {
          did: "did:foo",
          accounts: [
            { did: "did:bar", handle: "bar.bsky.social" },
            { did: "did:foo", handle: "foo.bsky.social" },
          ],
        },
        serviceOverride: {
          checkSession: mock(async () => {
            call++;
            return call === 1 ? null : { did: "did:bar", handle: "bar.bsky.social" };
          }),
        },
      });
      const res = await app.request("/session", { headers });
      const body = await res.json();
      assert.strictEqual(body.isLoggedIn, true);
      assert.strictEqual(body.did, "did:bar");
    });

    test("returns isLoggedIn:false when checkSession throws", async () => {
      const { app, headers } = makeApp({
        session: { did: "did:foo" },
        serviceOverride: {
          checkSession: mock(async () => {
            throw new Error("session error");
          }),
        },
      });
      const res = await app.request("/session", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { isLoggedIn: false, profile: null, did: null });
    });

    test("removes the fallback account too when its session is also invalid", async () => {
      // Active account invalid → fall back to first remembered account → that
      // one is ALSO invalid → both removed, session cleared.
      const { app, headers } = makeApp({
        session: {
          did: "did:foo",
          accounts: [
            { did: "did:bar", handle: "bar.bsky.social" },
            { did: "did:foo", handle: "foo.bsky.social" },
          ],
        },
        serviceOverride: { checkSession: mock(async () => null) },
      });
      const res = await app.request("/session", { headers });
      const body = await res.json();
      assert.strictEqual(body.isLoggedIn, false);
    });
  });

  describe("GET /client-metadata.json", () => {
    test("returns ctx.oauthClient.clientMetadata", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/client-metadata.json", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { client_id: "test-client" });
    });
  });

  describe("POST /accounts/switch", () => {
    test("returns 400 when did is missing", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/accounts/switch", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
    });

    test("returns 400 with the DID_REQUIRED code when did is empty", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/accounts/switch", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ did: "" }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.errors[0].message, "DID_REQUIRED");
    });

    test("returns 403 and logs when DID is not in the session (probing attempt)", async () => {
      const { app, ctx, headers } = makeApp({
        session: {
          did: "did:plc:foo",
          accounts: [{ did: "did:plc:foo", handle: "foo.bsky.social" }],
        },
      });
      const res = await app.request("/accounts/switch", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ did: "did:plc:attacker" }),
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual((ctx.logger.warn as any).mock.calls.length, 1);
    });

    test("returns 400 for a malformed DID that passes Zod but fails isValidDid", async () => {
      // "not-a-did" satisfies Zod min(1).max(512) but isn't a valid DID —
      // exercises the defense-in-depth isValidDid guard.
      const { app, ctx, headers } = makeApp({
        session: { did: "did:plc:foo", accounts: [{ did: "did:plc:foo" }] },
      });
      const res = await app.request("/accounts/switch", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ did: "not-a-did" }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, "INVALID_DID");
      // The DID-format check runs before the session lookup, so no warn log.
      assert.strictEqual((ctx.logger.warn as any).mock.calls.length, 0);
    });

    test("switches active DID when account is remembered and token is valid", async () => {
      const { app, notifications, headers } = makeApp({
        session: {
          did: "did:plc:foo",
          accounts: [
            { did: "did:plc:foo", handle: "foo.bsky.social" },
            { did: "did:plc:bar", handle: "bar.bsky.social" },
          ],
        },
        serviceOverride: {
          checkSession: mock(async () => ({
            did: "did:plc:bar",
            handle: "bar.bsky.social",
            displayName: "Bar",
            avatar: "img",
          })),
        },
      });
      const res = await app.request("/accounts/switch", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ did: "did:plc:bar" }),
      });
      const body = await res.json();
      assert.deepStrictEqual(body, { success: true, did: "did:plc:bar" });
      // Fire-and-forget push-subscription sync across all remembered accounts.
      await new Promise((resolve) => setImmediate(resolve));
      assert.strictEqual(notifications.syncSubscriptionsAcrossAccounts.mock.calls.length, 1);
    });

    test("logs an error when the push-subscription sync rejects (fire-and-forget)", async () => {
      const { app, ctx, headers } = makeApp({
        session: {
          did: "did:plc:foo",
          accounts: [
            { did: "did:plc:foo", handle: "foo.bsky.social" },
            { did: "did:plc:bar", handle: "bar.bsky.social" },
          ],
        },
        serviceOverride: {
          checkSession: mock(async () => ({ did: "did:plc:bar", handle: "bar.bsky.social" })),
        },
        notificationOverride: {
          syncSubscriptionsAcrossAccounts: mock(async () => {
            throw new Error("push sync failed");
          }),
        },
      });
      await app.request("/accounts/switch", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ did: "did:plc:bar" }),
      });
      await new Promise((resolve) => setImmediate(resolve));
      assert.strictEqual((ctx.logger.error as any).mock.calls.length, 1);
    });

    test("returns 401 and drops the account when its token has expired", async () => {
      const { app, headers } = makeApp({
        session: {
          did: "did:plc:foo",
          accounts: [
            { did: "did:plc:foo", handle: "foo.bsky.social" },
            { did: "did:plc:bar", handle: "bar.bsky.social" },
          ],
        },
        serviceOverride: { checkSession: mock(async () => null) },
      });
      const res = await app.request("/accounts/switch", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ did: "did:plc:bar" }),
      });
      assert.strictEqual(res.status, 401);
    });

    test("returns 500 when checkSession throws", async () => {
      const { app, headers } = makeApp({
        session: {
          did: "did:plc:foo",
          accounts: [{ did: "did:plc:bar", handle: "bar.bsky.social" }],
        },
        serviceOverride: {
          checkSession: mock(async () => {
            throw new Error("boom");
          }),
        },
      });
      const res = await app.request("/accounts/switch", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ did: "did:plc:bar" }),
      });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("GET /oauth/callback", () => {
    test("redirects with token on callback success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/oauth/callback?code=abc&state=xyz", { headers });
      assert.strictEqual(res.status, 302);
      const location = res.headers.get("location") ?? "";
      assert.ok(location.includes("oauth_token=enc-token"));
    });

    test("still redirects with token when db profile creation throws", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          createOrConfirmUserProfile: mock(async () => {
            throw new Error("db error");
          }),
        },
      });
      const res = await app.request("/oauth/callback?code=abc&state=xyz", { headers });
      const location = res.headers.get("location") ?? "";
      assert.ok(location.includes("oauth_token=enc-token"));
    });

    test("redirects with error=server_config when encryptDid throws", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          encryptDid: mock(() => {
            throw new Error("no secret");
          }),
        },
      });
      const res = await app.request("/oauth/callback?code=abc&state=xyz", { headers });
      const location = res.headers.get("location") ?? "";
      assert.ok(location.includes("error=server_config"));
    });

    test("redirects with error=oauth_failed when callback throws", async () => {
      const { app, headers } = makeApp({
        ctxOverrides: {
          oauthClient: {
            clientMetadata: { client_id: "test-client" },
            callback: mock(async () => {
              throw new Error("oauth error");
            }),
          },
        },
      });
      const res = await app.request("/oauth/callback?code=abc&state=xyz", { headers });
      const location = res.headers.get("location") ?? "";
      assert.ok(location.includes("error=oauth_failed"));
    });
  });

  describe("POST /oauth/consume", () => {
    test("returns 400 when oauth_token is missing", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/oauth/consume", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
    });

    test("returns 500 when decryptDid throws", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          decryptDid: mock(() => {
            throw new Error("bad secret");
          }),
        },
      });
      const res = await app.request("/oauth/consume", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ oauth_token: "bad" }),
      });
      assert.strictEqual(res.status, 500);
    });

    test("returns 404 when user not found", async () => {
      const { app, headers } = makeApp({
        serviceOverride: { findUserByDid: mock(async () => null) },
      });
      const res = await app.request("/oauth/consume", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ oauth_token: "token" }),
      });
      assert.strictEqual(res.status, 404);
    });

    test("returns success and sets nf-region cookie based on PDS (bsky.social → us)", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/oauth/consume", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ oauth_token: "token" }),
      });
      const body = await res.json();
      assert.deepStrictEqual(body, { success: true });
      const setCookie = res.headers.get("set-cookie") ?? "";
      assert.ok(setCookie.includes("nf-region=us"), "expected nf-region=us cookie");
    });

    test("sets eu cookie for non-bsky PDS", async () => {
      const { app, headers } = makeApp({
        ctxOverrides: {
          idResolver: {
            did: {
              resolveAtprotoData: mock(async () => ({ pds: "https://my-pds.example.com" })),
            },
          },
        },
      });
      const res = await app.request("/oauth/consume", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ oauth_token: "token" }),
      });
      const setCookie = res.headers.get("set-cookie") ?? "";
      assert.ok(setCookie.includes("nf-region=eu"), "expected nf-region=eu cookie");
    });

    test("returns success even when PDS resolution fails (no region cookie)", async () => {
      const { app, headers } = makeApp({
        ctxOverrides: {
          idResolver: {
            did: {
              resolveAtprotoData: mock(async () => {
                throw new Error("dns failure");
              }),
            },
          },
        },
      });
      const res = await app.request("/oauth/consume", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ oauth_token: "token" }),
      });
      const body = await res.json();
      assert.deepStrictEqual(body, { success: true });
      // No nf-region cookie, but the nf-session cookie IS set by setSession.
      const setCookie = res.headers.get("set-cookie") ?? "";
      assert.ok(
        !setCookie.includes("nf-region="),
        "did not expect nf-region cookie on PDS failure"
      );
    });

    test("returns 400 when findUserByDid throws", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          findUserByDid: mock(async () => {
            throw new Error("db error");
          }),
        },
      });
      const res = await app.request("/oauth/consume", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ oauth_token: "token" }),
      });
      assert.strictEqual(res.status, 400);
    });
  });
});
