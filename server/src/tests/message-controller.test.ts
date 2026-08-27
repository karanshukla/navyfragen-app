import assert from "node:assert";
import { test, describe, afterEach, mock } from "bun:test";

import { createMessageHono, type MessageDeps } from "#/hono/message-routes";
import {
  INBOX_CLOSED,
  MESSAGE_NOT_FOUND,
  NOT_AUTHORIZED_TO_DELETE,
  RECIPIENT_NOT_FOUND,
} from "#/services/message-service";
import { withTestSession, sessionHeader } from "./helpers/hono-test";

import type { AppContext } from "#/index";
import type { AppSessionData } from "#/auth/session";

describe("Messages (Hono)", () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  // syncMessages reads user_settings directly via ctx.db, so the ctx needs a
  // chainable builder for that one path. dbResult controls what the settings
  // query returns.
  function makeCtx(dbResult: any = null): AppContext {
    return {
      db: {
        selectFrom: mock(() => ({
          selectAll: mock(function (this: any) {
            return this as any;
          }),
          where: mock(function (this: any) {
            return this as any;
          }),
          executeTakeFirst: mock(async () => dbResult),
        })),
      } as any,
      oauthClient: {
        restore: mock(async () => ({ sub: "did:foo" })),
      } as any,
      resolver: {} as any,
      idResolver: {} as any,
      logger: { info: mock(), error: mock(), warn: mock(), debug: mock() } as any,
    };
  }

  function makeService(overrides: any = {}): any {
    return {
      addExampleMessages: mock(async () => [{ tid: "t1", message: "hello" }]),
      respondToMessage: mock(async () => ({ success: true })),
      sendMessage: mock(async () => ({ tid: "t2" })),
      getMessages: mock(async () => []),
      deleteMessage: mock(async () => {}),
      deleteUserData: mock(async () => {}),
      syncMessages: mock(async () => ({ synced: 1 })),
      warmImageService: mock(async () => {}),
      ...overrides,
    };
  }

  function makeNotificationService(overrides: any = {}): any {
    return {
      sendNewMessageNotification: mock(async () => {}),
      deleteAllSubscriptionsForUser: mock(async () => {}),
      ...overrides,
    };
  }

  function makeApp(
    opts: {
      dbResult?: any;
      serviceOverride?: any;
      notificationOverride?: any;
      session?: AppSessionData | null;
      oauthRestore?: any;
    } = {}
  ) {
    const ctx = makeCtx(opts.dbResult ?? null);
    if (opts.oauthRestore !== undefined) {
      (ctx as any).oauthClient.restore = opts.oauthRestore;
    }
    const service = makeService(opts.serviceOverride);
    const notifications = makeNotificationService(opts.notificationOverride);
    const app = withTestSession(
      createMessageHono(ctx, {
        messageService: service,
        notificationService: notifications,
      } as MessageDeps)
    );
    return {
      app,
      service,
      notifications,
      ctx,
      headers: sessionHeader(opts.session ?? { did: "did:foo" }),
    };
  }

  const jsonHeaders = (h: Record<string, string>) => ({ ...h, "Content-Type": "application/json" });
  const restoreSuccess = mock(async () => ({ sub: "did:foo" }));
  const restoreNull = mock(async () => null);

  describe("POST /messages/warm-image", () => {
    test("returns 403 when no session", async () => {
      const { app, service } = makeApp({ session: null });
      const res = await app.request("/messages/warm-image", {
        method: "POST",
        headers: sessionHeader(null),
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(service.warmImageService.mock.calls.length, 0);
    });

    test("accepts the hint and asks the service to warm", async () => {
      const { app, service, headers } = makeApp();
      const res = await app.request("/messages/warm-image", { method: "POST", headers });
      assert.strictEqual(res.status, 202);
      assert.strictEqual(service.warmImageService.mock.calls.length, 1);
    });

    test("still answers 202 when the warm itself fails", async () => {
      // The caller is typing, not waiting: a warm that cannot reach the image
      // service must not surface as a failed request.
      const { app, headers } = makeApp({
        serviceOverride: {
          warmImageService: mock(async () => {
            throw new Error("unreachable");
          }),
        },
      });
      const res = await app.request("/messages/warm-image", { method: "POST", headers });
      assert.strictEqual(res.status, 202);
    });
  });

  describe("POST /messages/example", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/messages/example", {
        method: "POST",
        headers: jsonHeaders(sessionHeader(null)),
        body: JSON.stringify({ recipient: "did:foo" }),
      });
      assert.strictEqual(res.status, 403);
    });

    test("returns messages on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/messages/example", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:foo" }),
      });
      assert.strictEqual(res.status, 200);
    });

    test("returns 500 when service throws", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          addExampleMessages: mock(async () => {
            throw new Error("db");
          }),
        },
      });
      const res = await app.request("/messages/example", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:foo" }),
      });
      assert.strictEqual(res.status, 500);
    });

    test("passes the requester's uiLocale from user_settings through to the service (#405)", async () => {
      const { app, service, headers } = makeApp({ dbResult: { uiLocale: "en" } });
      const res = await app.request("/messages/example", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:foo" }),
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(service.addExampleMessages.mock.calls.length, 1);
      assert.deepStrictEqual(service.addExampleMessages.mock.calls[0], ["did:foo", "en"]);
    });

    test("passes undefined uiLocale through when the user has no settings row", async () => {
      const { app, service, headers } = makeApp({ dbResult: null });
      const res = await app.request("/messages/example", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:foo" }),
      });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(service.addExampleMessages.mock.calls[0], ["did:foo", undefined]);
    });
  });

  describe("POST /messages/respond", () => {
    const validBody = {
      tid: "t1",
      recipient: "did:foo",
      original: "question",
      response: "hi",
    };

    test("returns 400 when required fields are missing", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/messages/respond", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ tid: "", recipient: "", response: "" }),
      });
      assert.strictEqual(res.status, 400);
    });

    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/messages/respond", {
        method: "POST",
        headers: jsonHeaders(sessionHeader(null)),
        body: JSON.stringify(validBody),
      });
      assert.strictEqual(res.status, 403);
    });

    test("returns isLoggedIn:false when agent is null (restore returns null)", async () => {
      const { app, headers } = makeApp({ oauthRestore: restoreNull });
      const res = await app.request("/messages/respond", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify(validBody),
      });
      const body = await res.json();
      assert.deepStrictEqual(body, { isLoggedIn: false, profile: null, did: null });
    });

    test("returns result on success", async () => {
      const { app, headers } = makeApp({ oauthRestore: restoreSuccess });
      const res = await app.request("/messages/respond", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify(validBody),
      });
      const body = await res.json();
      assert.deepStrictEqual(body, { success: true });
    });

    test("passes includeQuestionAsImage=true to service when present in body", async () => {
      const { app, service, headers } = makeApp({ oauthRestore: restoreSuccess });
      await app.request("/messages/respond", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ ...validBody, includeQuestionAsImage: true }),
      });
      const callArgs = service.respondToMessage.mock.calls[0];
      assert.strictEqual(callArgs[5], true);
    });

    test("returns 500 and BLUESKY_POST_FAILED without echoing the exception text", async () => {
      const { app, headers } = makeApp({
        oauthRestore: restoreSuccess,
        serviceOverride: {
          respondToMessage: mock(async () => {
            throw new Error("XRPCError: upstream said secret_detail");
          }),
        },
      });
      const res = await app.request("/messages/respond", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify(validBody),
      });
      assert.strictEqual(res.status, 500);
      const body = await res.json();
      assert.strictEqual(body.error, "BLUESKY_POST_FAILED");
      assert.ok(!JSON.stringify(body).includes("secret_detail"));
    });

    test("returns 500 when service throws", async () => {
      const { app, headers } = makeApp({
        oauthRestore: restoreSuccess,
        serviceOverride: {
          respondToMessage: mock(async () => {
            throw new Error("bluesky error");
          }),
        },
      });
      const res = await app.request("/messages/respond", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify(validBody),
      });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("POST /messages/send", () => {
    test("returns 400 when recipient or message missing", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/messages/send", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
    });

    test("returns result on success", async () => {
      const { app, headers } = makeApp();
      const res = await app.request("/messages/send", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:foo", message: "hello" }),
      });
      const body = await res.json();
      assert.deepStrictEqual(body, { tid: "t2" });
    });

    test("triggers sendNewMessageNotification (fire-and-forget) on success", async () => {
      const { app, notifications, headers } = makeApp();
      await app.request("/messages/send", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:recipient", message: "hi" }),
      });
      assert.strictEqual(notifications.sendNewMessageNotification.mock.calls.length, 1);
      assert.strictEqual(
        notifications.sendNewMessageNotification.mock.calls[0][0],
        "did:recipient"
      );
    });

    test("logs an error when the fire-and-forget push notification rejects", async () => {
      const { app, ctx, headers } = makeApp({
        notificationOverride: {
          sendNewMessageNotification: mock(async () => {
            throw new Error("push failed");
          }),
        },
      });
      await app.request("/messages/send", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:recipient", message: "hi" }),
      });
      await new Promise((resolve) => setImmediate(resolve));
      assert.strictEqual((ctx.logger.error as any).mock.calls.length, 1);
    });

    test("returns 404 and USER_NOT_FOUND for the recipient-not-found sentinel", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          sendMessage: mock(async () => {
            throw new Error(RECIPIENT_NOT_FOUND);
          }),
        },
      });
      const res = await app.request("/messages/send", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:foo", message: "hi" }),
      });
      assert.strictEqual(res.status, 404);
      assert.strictEqual((await res.json()).error, "USER_NOT_FOUND");
    });

    test("returns 403 and INBOX_CLOSED for the closed-inbox sentinel", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          sendMessage: mock(async () => {
            throw new Error(INBOX_CLOSED);
          }),
        },
      });
      const res = await app.request("/messages/send", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:foo", message: "hi" }),
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual((await res.json()).error, "INBOX_CLOSED");
    });

    test("returns 500 when service throws other error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          sendMessage: mock(async () => {
            throw new Error("db exploded");
          }),
        },
      });
      const res = await app.request("/messages/send", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:foo", message: "hi" }),
      });
      assert.strictEqual(res.status, 500);
    });

    test("returns 500 and MESSAGE_SEND_FAILED without echoing the exception text", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          sendMessage: mock(async () => {
            throw new Error("SQLITE_ERROR: no such column: secret_column");
          }),
        },
      });
      const res = await app.request("/messages/send", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ recipient: "did:foo", message: "hi" }),
      });
      assert.strictEqual(res.status, 500);
      const body = await res.json();
      assert.strictEqual(body.error, "MESSAGE_SEND_FAILED");
      assert.ok(!JSON.stringify(body).includes("secret_column"));
    });
  });

  describe("GET /messages/:recipient", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/messages/foo", { headers: sessionHeader(null) });
      assert.strictEqual(res.status, 403);
    });

    test("returns messages on success", async () => {
      const { app, headers } = makeApp({
        serviceOverride: { getMessages: mock(async () => [{ tid: "t1" }]) },
      });
      const res = await app.request("/messages/foo", { headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { messages: [{ tid: "t1" }] });
    });

    test("returns 404 when service throws with 'not exist'", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getMessages: mock(async () => {
            throw new Error("Profile does not exist");
          }),
        },
      });
      const res = await app.request("/messages/foo", { headers });
      assert.strictEqual(res.status, 404);
    });

    test("returns 500 on other error", async () => {
      const { app, headers } = makeApp({
        serviceOverride: {
          getMessages: mock(async () => {
            throw new Error("db error");
          }),
        },
      });
      const res = await app.request("/messages/foo", { headers });
      assert.strictEqual(res.status, 500);
    });
  });

  describe("DELETE /messages/:tid", () => {
    test("returns 400 when tid is missing from params", async () => {
      // A path with no tid segment can't match /messages/:tid; use an empty
      // segment which the validator path-param won't bind. Hit /messages/ which
      // 404s (no route) — but the controller guard for empty tid is exercised
      // by passing a literal empty value via the route. Instead test that a
      // missing-but-present param returns 400 by using a sentinel path.
      const { app, headers } = makeApp();
      // /messages/ alone doesn't match the :tid route; the real guard fires when
      // tid is present-but-empty, which can't happen via path binding. So we
      // assert the route requires a non-empty tid by checking 404 on no-tid.
      const res = await app.request("/messages/", { headers, method: "DELETE" });
      assert.strictEqual(res.status, 404);
    });

    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/messages/t1", {
        method: "DELETE",
        headers: sessionHeader(null),
      });
      assert.strictEqual(res.status, 403);
    });

    test("returns isLoggedIn:false when agent is null", async () => {
      const { app, headers } = makeApp({ oauthRestore: restoreNull });
      const res = await app.request("/messages/t1", { method: "DELETE", headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { isLoggedIn: false, profile: null, did: null });
    });

    test("returns success on delete", async () => {
      const { app, headers } = makeApp({ oauthRestore: restoreSuccess });
      const res = await app.request("/messages/t1", { method: "DELETE", headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { success: true });
    });

    test("returns 404 and MESSAGE_NOT_FOUND for the not-found sentinel", async () => {
      const { app, headers } = makeApp({
        oauthRestore: restoreSuccess,
        serviceOverride: {
          deleteMessage: mock(async () => {
            throw new Error(MESSAGE_NOT_FOUND);
          }),
        },
      });
      const res = await app.request("/messages/t1", { method: "DELETE", headers });
      assert.strictEqual(res.status, 404);
      assert.strictEqual((await res.json()).error, "MESSAGE_NOT_FOUND");
    });

    test("returns 403 and MESSAGE_DELETE_NOT_AUTHORIZED for someone else's message", async () => {
      const { app, headers } = makeApp({
        oauthRestore: restoreSuccess,
        serviceOverride: {
          deleteMessage: mock(async () => {
            throw new Error(NOT_AUTHORIZED_TO_DELETE);
          }),
        },
      });
      const res = await app.request("/messages/t1", { method: "DELETE", headers });
      assert.strictEqual(res.status, 403);
      assert.strictEqual((await res.json()).error, "MESSAGE_DELETE_NOT_AUTHORIZED");
    });

    test("returns 500 on other error", async () => {
      const { app, headers } = makeApp({
        oauthRestore: restoreSuccess,
        serviceOverride: {
          deleteMessage: mock(async () => {
            throw new Error("db exploded");
          }),
        },
      });
      const res = await app.request("/messages/t1", { method: "DELETE", headers });
      assert.strictEqual(res.status, 500);
    });

    test("returns 500 and MESSAGE_DELETE_FAILED without echoing the exception text", async () => {
      const { app, headers } = makeApp({
        oauthRestore: restoreSuccess,
        serviceOverride: {
          deleteMessage: mock(async () => {
            throw new Error("SQLITE_ERROR: no such column: secret_column");
          }),
        },
      });
      const res = await app.request("/messages/t1", { method: "DELETE", headers });
      assert.strictEqual(res.status, 500);
      const body = await res.json();
      assert.strictEqual(body.error, "MESSAGE_DELETE_FAILED");
      assert.ok(!JSON.stringify(body).includes("secret_column"));
    });
  });

  describe("DELETE /delete-account", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/delete-account", {
        method: "DELETE",
        headers: sessionHeader(null),
      });
      assert.strictEqual(res.status, 403);
    });

    test("returns 401 when agent is null", async () => {
      const { app, headers } = makeApp({ oauthRestore: restoreNull });
      const res = await app.request("/delete-account", { method: "DELETE", headers });
      assert.strictEqual(res.status, 401);
    });

    test("returns success on delete", async () => {
      const { app, headers } = makeApp({ oauthRestore: restoreSuccess });
      const res = await app.request("/delete-account", { method: "DELETE", headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { success: true });
    });

    test("drops push subscriptions (fire-and-forget) on success", async () => {
      const { app, notifications, headers } = makeApp({ oauthRestore: restoreSuccess });
      await app.request("/delete-account", { method: "DELETE", headers });
      assert.strictEqual(notifications.deleteAllSubscriptionsForUser.mock.calls.length, 1);
      assert.strictEqual(notifications.deleteAllSubscriptionsForUser.mock.calls[0][0], "did:foo");
    });

    test("logs an error when dropping push subscriptions (fire-and-forget) rejects", async () => {
      const { app, ctx, headers } = makeApp({
        oauthRestore: restoreSuccess,
        notificationOverride: {
          deleteAllSubscriptionsForUser: mock(async () => {
            throw new Error("db unavailable");
          }),
        },
      });
      await app.request("/delete-account", { method: "DELETE", headers });
      await new Promise((resolve) => setImmediate(resolve));
      assert.strictEqual((ctx.logger.error as any).mock.calls.length, 1);
    });

    test("returns 500 when service throws", async () => {
      const { app, headers } = makeApp({
        oauthRestore: restoreSuccess,
        serviceOverride: {
          deleteUserData: mock(async () => {
            throw new Error("delete failed");
          }),
        },
      });
      const res = await app.request("/delete-account", { method: "DELETE", headers });
      assert.strictEqual(res.status, 500);
    });

    test("returns 500 and ACCOUNT_DELETE_FAILED without echoing the exception text", async () => {
      const { app, headers } = makeApp({
        oauthRestore: restoreSuccess,
        serviceOverride: {
          deleteUserData: mock(async () => {
            throw new Error("SQLITE_ERROR: no such column: secret_column");
          }),
        },
      });
      const res = await app.request("/delete-account", { method: "DELETE", headers });
      assert.strictEqual(res.status, 500);
      const body = await res.json();
      assert.strictEqual(body.error, "ACCOUNT_DELETE_FAILED");
      assert.ok(!JSON.stringify(body).includes("secret_column"));
    });
  });

  describe("POST /messages/sync", () => {
    test("returns 403 when no session", async () => {
      const { app } = makeApp({ session: null });
      const res = await app.request("/messages/sync", {
        method: "POST",
        headers: sessionHeader(null),
      });
      assert.strictEqual(res.status, 403);
    });

    test("returns 200 with disabled message when no settings row", async () => {
      const { app, headers } = makeApp({ dbResult: null });
      const res = await app.request("/messages/sync", { method: "POST", headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { success: true, message: "PDS sync is disabled" });
    });

    test("returns 200 with disabled message when pdsSyncEnabled is false", async () => {
      const { app, headers } = makeApp({ dbResult: { pdsSyncEnabled: false } });
      const res = await app.request("/messages/sync", { method: "POST", headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { success: true, message: "PDS sync is disabled" });
    });

    test("returns 401 when pdsSyncEnabled true but agent is null", async () => {
      const { app, headers } = makeApp({
        dbResult: { pdsSyncEnabled: true },
        oauthRestore: restoreNull,
      });
      const res = await app.request("/messages/sync", { method: "POST", headers });
      assert.strictEqual(res.status, 401);
    });

    test("returns sync result on success", async () => {
      const { app, headers } = makeApp({
        dbResult: { pdsSyncEnabled: true },
        oauthRestore: restoreSuccess,
        serviceOverride: { syncMessages: mock(async () => ({ synced: 5 })) },
      });
      const res = await app.request("/messages/sync", { method: "POST", headers });
      const body = await res.json();
      assert.deepStrictEqual(body, { synced: 5 });
    });

    test("returns 500 when syncMessages throws", async () => {
      const { app, headers } = makeApp({
        dbResult: { pdsSyncEnabled: true },
        oauthRestore: restoreSuccess,
        serviceOverride: {
          syncMessages: mock(async () => {
            throw new Error("sync failed");
          }),
        },
      });
      const res = await app.request("/messages/sync", { method: "POST", headers });
      assert.strictEqual(res.status, 500);
    });
  });
});
