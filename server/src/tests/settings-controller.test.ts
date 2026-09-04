import assert from "node:assert";
import { test, describe, afterEach, mock } from "bun:test";

import { createSettingsHono, type SettingsDeps } from "#/hono/message-routes";
import { withTestSession, sessionHeader } from "./helpers/hono-test";

import type { AppContext } from "#/index";
import type { AppSessionData } from "#/auth/session";

describe("Settings (Hono)", () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  function makeCtx(overrides: any = {}): AppContext {
    return {
      db: {} as any,
      oauthClient: {
        restore: mock(async () => ({ sub: "did:foo" })),
      } as any,
      idResolver: {} as any,
      resolver: {} as any,
      logger: { info: mock(), error: mock(), warn: mock(), debug: mock() } as any,
      ...overrides,
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

  function makeApp(
    opts: { ctxOverrides?: any; serviceOverride?: any; session?: AppSessionData | null } = {}
  ) {
    const ctx = makeCtx(opts.ctxOverrides);
    const service = makeService(opts.serviceOverride);
    const app = withTestSession(
      createSettingsHono(ctx, { settingsService: service } as SettingsDeps)
    );
    return { app, service, ctx, headers: sessionHeader(opts.session ?? { did: "did:foo" }) };
  }

  const jsonHeaders = (h: Record<string, string>) => ({ ...h, "Content-Type": "application/json" });

  describe("GET /settings", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/settings", { headers: sessionHeader(null) });
      assert.strictEqual(res.status, 403);
    });

    test("returns existing settings when found", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/settings", { headers });
      assert.strictEqual(res.status, 200);
    });

    test("creates and returns default settings when none exist", async () => {
      const { app, service, headers } = makeApp({
        serviceOverride: { getUserSettings: mock(async () => null) },
      });
      await app.request("/settings", { headers });
      assert.strictEqual(service.createDefaultSettings.mock.calls.length, 1);
    });

    test("returns 500 on error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getUserSettings: mock(async () => {
            throw new Error("db");
          }),
        },
      });
      const res = await app.request("/settings", { headers });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("GET /stats", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/stats", { headers: sessionHeader(null) });
      assert.strictEqual(res.status, 403);
    });

    test("returns stats on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/stats", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { messageCount: 0 });
    });

    test("returns 500 on error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getStats: mock(async () => {
            throw new Error("db");
          }),
        },
      });
      const res = await app.request("/stats", { headers });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("GET /pds-info", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/pds-info", { headers: sessionHeader(null) });
      assert.strictEqual(res.status, 403);
    });

    test("returns 401 when agent is null", async () => {
      const { app, headers } = makeApp({
        ctxOverrides: { oauthClient: { restore: mock(async () => null) } },
      });
      const res = await app.request("/pds-info", { headers });
      assert.strictEqual(res.status, 401);
    });

    test("returns PDS info on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/pds-info", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { pdsUrl: "https://bsky.social", count: 0 });
    });

    test("returns 500 on error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getPdsInfo: mock(async () => {
            throw new Error("err");
          }),
        },
      });
      const res = await app.request("/pds-info", { headers });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("POST /settings", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(sessionHeader(null)),
        body: JSON.stringify({ pdsSyncEnabled: true }),
      });
      assert.strictEqual(res.status, 403);
    });

    test("returns updated settings on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ pdsSyncEnabled: true, imageTheme: "compressed" }),
      });
      const body = await res.json();
      assert.deepStrictEqual(body, { pdsSyncEnabled: true, imageTheme: "compressed" });
    });

    test("passes only provided fields through to the service (partial update)", async () => {
      const { app, service, headers } = makeApp();
      await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ inboxEnabled: false }),
      });
      const passed = service.updateSettings.mock.calls[0][1];
      assert.strictEqual(passed.inboxEnabled, false);
      // Fields the client didn't send come through as undefined (skip).
      assert.strictEqual(passed.pdsSyncEnabled, undefined);
      assert.strictEqual(passed.profanityFilterEnabled, undefined);
    });

    test("passes null through for nullable fields (means 'clear')", async () => {
      const { app, service, headers } = makeApp();
      await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ customPrompt: null, touchpointLocale: "es" }),
      });
      const passed = service.updateSettings.mock.calls[0][1];
      assert.strictEqual(passed.customPrompt, null);
      assert.strictEqual(passed.touchpointLocale, "es");
    });

    test("uiLocale: null unsets it, omitted leaves it alone", async () => {
      const { app, service, headers } = makeApp();
      await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ uiLocale: null }),
      });
      const passed = service.updateSettings.mock.calls[0][1];
      assert.strictEqual(passed.uiLocale, null);

      await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ inboxEnabled: false }),
      });
      const secondPass = service.updateSettings.mock.calls[1][1];
      assert.strictEqual(secondPass.uiLocale, undefined);
    });

    test("accepts a waypoint id as the default client", async () => {
      const { app, service, headers } = makeApp();
      const res = await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ defaultClient: "deer" }),
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(service.updateSettings.mock.calls[0][1].defaultClient, "deer");
    });

    test("defaultClient: null unsets it, omitted leaves it alone", async () => {
      const { app, service, headers } = makeApp();
      await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ defaultClient: null }),
      });
      assert.strictEqual(service.updateSettings.mock.calls[0][1].defaultClient, null);

      await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ inboxEnabled: false }),
      });
      assert.strictEqual(service.updateSettings.mock.calls[1][1].defaultClient, undefined);
    });

    test("rejects an over-long default client id", async () => {
      const { app, service, headers } = makeApp();
      const res = await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ defaultClient: "d".repeat(65) }),
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(service.updateSettings.mock.calls.length, 0);
    });

    test("passes the profile-link switch through as a boolean", async () => {
      const { app, service, headers } = makeApp();
      const res = await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ openProfilesInApp: false }),
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(service.updateSettings.mock.calls[0][1].openProfilesInApp, false);
    });

    test("rejects a profile-link switch that is not a boolean", async () => {
      const { app, service, headers } = makeApp();
      const res = await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ openProfilesInApp: "no" }),
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(service.updateSettings.mock.calls.length, 0);
    });

    test("accepts a default client id at the length limit", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ defaultClient: "d".repeat(64) }),
      });
      assert.strictEqual(res.status, 200);
    });

    test("accepts a regional variant of a shipped locale", async () => {
      const { app, service, headers } = makeApp();
      const res = await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ uiLocale: "es-419" }),
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(service.updateSettings.mock.calls[0][1].uiLocale, "es-419");
    });

    test("rejects a malformed locale tag", async () => {
      const { app, service, headers } = makeApp();
      for (const uiLocale of ["en-", "es-", "en--x", "toString"]) {
        const res = await app.request("/settings", {
          method: "POST",
          headers: jsonHeaders(headers),
          body: JSON.stringify({ uiLocale }),
        });
        assert.strictEqual(res.status, 400, uiLocale);
      }
      assert.strictEqual(service.updateSettings.mock.calls.length, 0);
    });

    test("rejects an unsupported language on either locale axis", async () => {
      const { app, service, headers } = makeApp();
      for (const body of [{ uiLocale: "ja" }, { touchpointLocale: "nl-BE" }]) {
        const res = await app.request("/settings", {
          method: "POST",
          headers: jsonHeaders(headers),
          body: JSON.stringify(body),
        });
        assert.strictEqual(res.status, 400, JSON.stringify(body));
      }
      assert.strictEqual(service.updateSettings.mock.calls.length, 0);
    });

    test("coerces profanityFilterEnabled to a strict boolean when provided", async () => {
      const { app, service, headers } = makeApp();
      await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ profanityFilterEnabled: true }),
      });
      const passed = service.updateSettings.mock.calls[0][1];
      assert.strictEqual(passed.profanityFilterEnabled, true);
    });

    test("returns 500 on error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          updateSettings: mock(async () => {
            throw new Error("db");
          }),
        },
      });
      const res = await app.request("/settings", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ pdsSyncEnabled: false }),
      });
      assert.strictEqual(res.status, 500);
    });
  });
});
