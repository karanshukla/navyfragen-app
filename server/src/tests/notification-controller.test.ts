import assert from "node:assert";
import { test, describe, afterEach, mock } from "bun:test";

import { createNotificationHono, type NotificationDeps } from "#/hono/message-routes";
import { withTestSession, sessionHeader } from "./helpers/hono-test";

import type { AppContext } from "#/index";
import type { AppSessionData } from "#/auth/session";

describe("Notifications (Hono)", () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  function makeService(overrides: any = {}): any {
    return {
      getVapidPublicKey: mock(() => "vapid-key"),
      saveSubscription: mock(async () => {}),
      syncSubscriptionsAcrossAccounts: mock(async () => {}),
      deleteSubscription: mock(async () => {}),
      ...overrides,
    };
  }

  function makeCtx(): AppContext {
    return {
      db: {} as any,
      logger: { info: mock(), error: mock(), warn: mock(), debug: mock() } as any,
      oauthClient: {} as any,
      resolver: {} as any,
      idResolver: {} as any,
    };
  }

  function makeApp(serviceOverride: any = {}, session: AppSessionData | null = { did: "did:foo" }) {
    const ctx = makeCtx();
    const service = makeService(serviceOverride);
    const app = withTestSession(
      createNotificationHono(ctx, { notificationService: service } as NotificationDeps)
    );
    return { app, service, headers: sessionHeader(session) };
  }

  const sessionDid = { did: "did:foo" } as AppSessionData;
  const validBody = {
    endpoint: "https://push.example.com/sub",
    keys: { p256dh: "p256-key", auth: "auth-key" },
  };

  test("withTestSession treats a malformed session header as no session", async () => {
    const { app } = makeApp();
    const res = await app.request("/notifications/vapid-public-key", {
      headers: { "x-test-session": "{not json" },
    });
    // No session → still a public endpoint, returns 200 with the key.
    assert.strictEqual(res.status, 200);
  });

  describe("GET /notifications/vapid-public-key", () => {
    test("returns the key from the service when configured", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/notifications/vapid-public-key", { headers });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body, { vapidPublicKey: "vapid-key" });
    });

    test("returns 501 when VAPID is not configured", async () => {
      const { app, headers } = makeApp({ getVapidPublicKey: mock(() => null) });
      const res = await app.request("/notifications/vapid-public-key", { headers });
      assert.strictEqual(res.status, 501);
    });
  });

  describe("POST /notifications/subscribe", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({}, null);
      const res = await app.request("/notifications/subscribe", {
        method: "POST",
        headers: { ...sessionHeader(null), "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      assert.strictEqual(res.status, 403);
    });

    test("returns 501 when VAPID is not configured", async () => {
      const { app, headers } = makeApp({ getVapidPublicKey: mock(() => null) });
      const res = await app.request("/notifications/subscribe", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      assert.strictEqual(res.status, 501);
    });

    test("saves subscription and returns 201 on success", async () => {
      const { app, service, headers } = makeApp();
      const res = await app.request("/notifications/subscribe", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.deepStrictEqual(body, { ok: true });
      const args = service.saveSubscription.mock.calls[0];
      assert.strictEqual(args[0], "did:foo");
      assert.strictEqual(args[1], "https://push.example.com/sub");
    });

    test("syncs the subscription across every account remembered on this device", async () => {
      const { app, service } = makeApp(
        {},
        {
          did: "did:foo",
          accounts: [
            { did: "did:foo", handle: "foo.bsky.social" },
            { did: "did:bar", handle: "bar.bsky.social" },
          ],
        }
      );
      await app.request("/notifications/subscribe", {
        method: "POST",
        headers: {
          ...sessionHeader({
            did: "did:foo",
            accounts: [{ did: "did:foo" }, { did: "did:bar" }],
          } as any),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validBody),
      });
      assert.deepStrictEqual(service.syncSubscriptionsAcrossAccounts.mock.calls[0][0], [
        "did:foo",
        "did:bar",
      ]);
    });

    test("returns 500 when service throws", async () => {
      const { app, headers } = makeApp({
        saveSubscription: mock(async () => {
          throw new Error("db down");
        }),
      });
      const res = await app.request("/notifications/subscribe", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("DELETE /notifications/subscribe", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({}, null);
      const res = await app.request("/notifications/subscribe", {
        method: "DELETE",
        headers: { ...sessionHeader(null), "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "https://push.example.com/sub" }),
      });
      assert.strictEqual(res.status, 403);
    });

    test("deletes subscription and returns ok on success", async () => {
      const { app, service, headers } = makeApp({}, sessionDid);
      const res = await app.request("/notifications/subscribe", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "https://push.example.com/sub" }),
      });
      const body = await res.json();
      assert.deepStrictEqual(body, { ok: true });
      const args = service.deleteSubscription.mock.calls[0];
      assert.strictEqual(args[0], "did:foo");
      assert.strictEqual(args[1], "https://push.example.com/sub");
    });

    test("returns 500 when service throws", async () => {
      const { app, headers } = makeApp({
        deleteSubscription: mock(async () => {
          throw new Error("db down");
        }),
      });
      const res = await app.request("/notifications/subscribe", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "https://push.example.com/sub" }),
      });
      assert.strictEqual(res.status, 500);
    });
  });
});
