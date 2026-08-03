// Message, profile, settings, and notification route handlers. Business logic
// stays in the services (reused unchanged); only the req/res I/O is Hono's
// Context. Validation uses Zod schemas (the client already uses Zod v4).

import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { errorMessage } from "#/lib/errors";
import { MessageService } from "#/services/message-service";
import { NotificationService } from "#/services/notification-service";
import { ProfileService } from "#/services/profile-service";
import { SettingsService } from "#/services/settings-service";
import { getAccounts } from "#/auth/session";
import { clearSession, getSession } from "./session-middleware";
import { initializeAgentFromHonoSession } from "./session-agent-hono";

import type { AppContext } from "#/index";

const BOT_DID = "did:plc:3d4awubjiftylwrhhyp5vl7i";

/** Optional injected services — production omits this (uses real services); tests pass mocks. */
export interface MessageDeps {
  messageService?: MessageService;
  notificationService?: NotificationService;
}

export function createMessageHono(ctx: AppContext, deps: MessageDeps = {}): Hono {
  const app = new Hono();
  const messageService =
    deps.messageService ?? new MessageService(ctx.db, ctx.resolver, ctx.logger);
  const notificationService =
    deps.notificationService ?? new NotificationService(ctx.db, ctx.resolver, ctx.logger);

  // --- POST /messages/example ---------------------------------------------
  app.post(
    "/messages/example",
    zValidator("json", z.object({ recipient: z.string().min(1) }), (r, c) => {
      if (!r.success) return c.json({ errors: r.error.issues }, 400);
    }),
    async (c) => {
      const recipient = getSession(c)?.did;
      if (!recipient) return c.json({ error: "Recipient DID required" }, 403);
      try {
        const messages = await messageService.addExampleMessages(recipient);
        return c.json({ messages });
      } catch (err) {
        ctx.logger.error({ err, recipient }, "Failed to add example messages");
        return c.json({ error: "Failed to add example messages" }, 500);
      }
    }
  );

  // --- POST /messages/respond ---------------------------------------------
  app.post(
    "/messages/respond",
    zValidator(
      "json",
      z.object({
        tid: z.string().min(1),
        recipient: z.string().min(1),
        original: z.string().min(1),
        response: z.string().min(1).max(500),
        includeQuestionAsImage: z.boolean().optional(),
        replyTo: z.object({ uri: z.string(), cid: z.string().optional() }).passthrough().optional(),
      }),
      (r, c) => {
        if (!r.success) return c.json({ errors: r.error.issues }, 400);
      }
    ),
    async (c) => {
      const body = c.req.valid("json");
      const { tid, recipient, original, response, includeQuestionAsImage, replyTo } = body;
      if (!tid || !recipient || !response) {
        ctx.logger.warn(
          { tid, recipient, response },
          "Missing required fields in respond endpoint"
        );
        return c.json({ error: "Missing required fields" }, 400);
      }
      const did = getSession(c)?.did;
      if (!did) {
        ctx.logger.warn("No authenticated user session found");
        return c.json({ error: "Not authenticated" }, 403);
      }
      const agent = await initializeAgentFromHonoSession(c, ctx);
      if (!agent) {
        ctx.logger.warn({ did }, "No agent could be initialized from session");
        return c.json({ isLoggedIn: false, profile: null, did: null });
      }
      try {
        const result = await messageService.respondToMessage(
          tid,
          did,
          recipient,
          original,
          response,
          includeQuestionAsImage || false,
          agent,
          replyTo
        );
        return c.json(result);
      } catch (err: unknown) {
        ctx.logger.error(
          { err, tid, did },
          "Error in /messages/respond endpoint while trying to post to Bluesky"
        );
        return c.json({ error: errorMessage(err) || "Failed to post to Bluesky" }, 500);
      }
    }
  );

  // --- POST /messages/send (anonymous) ------------------------------------
  app.post(
    "/messages/send",
    zValidator(
      "json",
      z.object({
        recipient: z.string().min(1),
        message: z.string().min(1).max(500),
      }),
      (r, c) => {
        if (!r.success) return c.json({ errors: r.error.issues }, 400);
      }
    ),
    async (c) => {
      const { recipient, message } = c.req.valid("json");
      if (!recipient || !message) {
        return c.json({ error: "Recipient and message required" }, 400);
      }
      try {
        const result = await messageService.sendMessage(recipient, message);
        ctx.logger.debug({ recipient }, "Anonymous message sent");
        notificationService
          .sendNewMessageNotification(recipient)
          .catch((err) =>
            ctx.logger.error({ err, did: recipient }, "Failed to send push notification")
          );
        return c.json(result);
      } catch (err: unknown) {
        ctx.logger.error({ err, recipient }, "Failed to send message");
        const msg = errorMessage(err);
        const status = msg.includes("not found") ? 404 : msg.includes("not accepting") ? 403 : 500;
        return c.json({ error: msg || "Failed to send message" }, status);
      }
    }
  );

  // --- GET /messages/:recipient -------------------------------------------
  app.get("/messages/:recipient", async (c) => {
    const recipient = getSession(c)?.did;
    if (!recipient) return c.json({ error: "Not authenticated" }, 403);
    try {
      const messages = await messageService.getMessages(recipient);
      return c.json({ messages });
    } catch (err: unknown) {
      if (errorMessage(err).includes("not exist")) {
        return c.json({ error: "User not found (user profile does not exist)" }, 404);
      }
      ctx.logger.error({ err, recipient }, "Failed to fetch messages");
      return c.json({ error: "Failed to fetch messages" }, 500);
    }
  });

  // --- DELETE /messages/:tid ----------------------------------------------
  app.delete("/messages/:tid", async (c) => {
    const tid = c.req.param("tid");
    if (!tid) return c.json({ error: "Message TID required" }, 400);
    const userSessionDid = getSession(c)?.did;
    if (!userSessionDid) return c.json({ error: "Not authenticated" }, 403);
    const agent = await initializeAgentFromHonoSession(c, ctx);
    if (!agent) {
      ctx.logger.warn({ userSessionDid }, "No agent could be initialized from session");
      return c.json({ isLoggedIn: false, profile: null, did: null });
    }
    try {
      await messageService.deleteMessage(tid, userSessionDid, agent);
      return c.json({ success: true });
    } catch (err: unknown) {
      const msg = errorMessage(err);
      const status = msg.includes("not found") ? 404 : msg.includes("Not authorized") ? 403 : 500;
      return c.json({ error: msg || "Failed to delete message" }, status);
    }
  });

  // --- DELETE /delete-account ---------------------------------------------
  app.delete("/delete-account", async (c) => {
    const userSessionDid = getSession(c)?.did;
    if (!userSessionDid) return c.json({ error: "Not authenticated" }, 403);
    const agent = await initializeAgentFromHonoSession(c, ctx);
    if (!agent) {
      return c.json(
        {
          error: "Authentication failed - could not initialize agent or retrieve user DID",
        },
        401
      );
    }
    try {
      await messageService.deleteUserData(userSessionDid, agent);
      notificationService
        .deleteAllSubscriptionsForUser(userSessionDid)
        .catch((err) =>
          ctx.logger.error({ err, did: userSessionDid }, "Failed to delete push subscriptions")
        );
      clearSession(c);
      ctx.logger.info({ did: userSessionDid }, "Account and all data deleted");
      return c.json({ success: true });
    } catch (err: unknown) {
      ctx.logger.error({ err, did: userSessionDid }, "Failed to delete account data");
      return c.json({ error: errorMessage(err) || "Failed to delete account data" }, 500);
    }
  });

  // --- POST /messages/sync ------------------------------------------------
  app.post("/messages/sync", async (c) => {
    const userSessionDid = getSession(c)?.did;
    if (!userSessionDid) return c.json({ error: "Not authenticated" }, 403);
    const userSettings = await ctx.db
      .selectFrom("user_settings")
      .selectAll()
      .where("did", "=", userSessionDid)
      .executeTakeFirst();
    if (!userSettings || !userSettings?.pdsSyncEnabled) {
      return c.json({ success: true, message: "PDS sync is disabled" });
    }
    const agent = await initializeAgentFromHonoSession(c, ctx);
    if (!agent) {
      return c.json({ error: "Authentication failed - could not initialize agent" }, 401);
    }
    try {
      const syncResult = await messageService.syncMessages(userSessionDid, agent);
      return c.json(syncResult);
    } catch (err: unknown) {
      ctx.logger.error({ err, did: userSessionDid }, "Failed to sync messages to PDS");
      return c.json({ error: "Failed to sync messages to PDS", details: errorMessage(err) }, 500);
    }
  });

  return app;
}

/** Optional injected services — production omits this (uses real services); tests pass mocks. */
export interface ProfileDeps {
  profileService?: ProfileService;
}

export function createProfileHono(ctx: AppContext, deps: ProfileDeps = {}): Hono {
  const app = new Hono();
  const profileService =
    deps.profileService ?? new ProfileService(ctx.db, ctx.resolver, ctx.logger);

  // --- GET /public-profile/:did -------------------------------------------
  app.get(
    "/public-profile/:did",
    zValidator("param", z.object({ did: z.string().min(1) }), (r, c) => {
      if (!r.success) return c.json({ errors: r.error.issues }, 400);
    }),
    async (c) => {
      const { did } = c.req.valid("param");
      try {
        const profileData = await profileService.getPublicProfile(did);
        return c.json(profileData);
      } catch (err: unknown) {
        if (errorMessage(err) === "Profile not found") {
          return c.json({ error: "Profile not found" }, 404);
        }
        ctx.logger.error({ err, did }, "Failed to fetch public profile");
        return c.json({ error: "Failed to fetch profile" }, 500);
      }
    }
  );

  // --- GET /user-exists/:did ----------------------------------------------
  app.get(
    "/user-exists/:did",
    zValidator("param", z.object({ did: z.string().min(1) }), (r, c) => {
      if (!r.success) return c.json({ errors: r.error.issues }, 400);
    }),
    async (c) => {
      const { did } = c.req.valid("param");
      try {
        const exists = await profileService.checkUserExists(did);
        return c.json({ exists, did });
      } catch (err) {
        ctx.logger.error({ err, did }, "Failed to check user existence");
        return c.json({ error: "Failed to check user existence" }, 500);
      }
    }
  );

  // --- GET /friends -------------------------------------------------------
  app.get("/friends", async (c) => {
    const userDid = getSession(c)?.did;
    if (!userDid) return c.json({ error: "Not authenticated" }, 403);
    try {
      const result = await profileService.getFriendsOnApp(userDid);
      return c.json(result);
    } catch (err) {
      ctx.logger.error({ err, did: userDid }, "Failed to fetch friends on app");
      return c.json({ error: "Failed to fetch friends" }, 500);
    }
  });

  // --- GET /check-bot-follow ----------------------------------------------
  app.get("/check-bot-follow", async (c) => {
    const userDid = getSession(c)?.did;
    if (!userDid) return c.json({ error: "Not authenticated" }, 403);
    const agent = await initializeAgentFromHonoSession(c, ctx);
    if (!agent) return c.json({ error: "Session expired" }, 401);
    try {
      const following = await profileService.checkFollowsBot(agent, BOT_DID);
      return c.json({ following });
    } catch (err) {
      ctx.logger.error({ err, did: userDid }, "Failed to check bot follow status");
      return c.json({ error: "Failed to check bot follow status" }, 500);
    }
  });

  // --- GET /handle-pds/:handle --------------------------------------------
  app.get(
    "/handle-pds/:handle",
    zValidator("param", z.object({ handle: z.string().min(1) }), (r, c) => {
      if (!r.success) return c.json({ errors: r.error.issues }, 400);
    }),
    async (c) => {
      const { handle } = c.req.valid("param");
      try {
        const did = await ctx.resolver.resolveHandleToDid(handle);
        if (!did) return c.json({ error: "Handle not found" }, 404);
        const atprotoData = await ctx.idResolver.did.resolveAtprotoData(did);
        const pdsUrl = new URL(atprotoData.pds);
        return c.json({ pds: pdsUrl.hostname });
      } catch (err) {
        ctx.logger.error({ err, handle }, "Failed to resolve PDS for handle");
        return c.json({ error: "Failed to resolve PDS" }, 500);
      }
    }
  );

  // --- GET /handle-search -------------------------------------------------
  app.get(
    "/handle-search",
    zValidator("query", z.object({ q: z.string().min(1).max(64) }), (r, c) => {
      if (!r.success) return c.json({ errors: r.error.issues }, 400);
    }),
    async (c) => {
      const { q } = c.req.valid("query");
      try {
        const actors = await profileService.searchActorsTypeahead(q);
        return c.json({ actors });
      } catch (err) {
        ctx.logger.error({ err }, "Failed to search handles");
        return c.json({ error: "Failed to search handles" }, 500);
      }
    }
  );

  // --- GET /resolve-handle/:handle ----------------------------------------
  app.get(
    "/resolve-handle/:handle",
    zValidator("param", z.object({ handle: z.string().min(1) }), (r, c) => {
      if (!r.success) return c.json({ errors: r.error.issues }, 400);
    }),
    async (c) => {
      const { handle } = c.req.valid("param");
      try {
        const did = await profileService.resolveHandleToDid(handle);
        return c.json({ did });
      } catch (err: unknown) {
        if (errorMessage(err) === "Handle not found") {
          return c.json({ error: "Handle not found" }, 404);
        }
        ctx.logger.error({ err, handle }, "Failed to resolve handle");
        return c.json({ error: "Failed to resolve handle" }, 500);
      }
    }
  );

  return app;
}

/** Optional injected services — production omits this (uses real services); tests pass mocks. */
export interface SettingsDeps {
  settingsService?: SettingsService;
}

export function createSettingsHono(ctx: AppContext, deps: SettingsDeps = {}): Hono {
  const app = new Hono();
  const settingsService = deps.settingsService ?? new SettingsService(ctx.db, ctx.logger);

  app.get("/settings", async (c) => {
    const userSessionDid = getSession(c)?.did;
    if (!userSessionDid) return c.json({ error: "Not authenticated" }, 403);
    try {
      let userSettings = await settingsService.getUserSettings(userSessionDid);
      if (!userSettings) {
        userSettings = await settingsService.createDefaultSettings(userSessionDid);
      }
      return c.json(userSettings);
    } catch (err) {
      ctx.logger.error({ err, did: userSessionDid }, "Failed to fetch user settings");
      return c.json({ error: "Failed to fetch user settings" }, 500);
    }
  });

  app.get("/stats", async (c) => {
    const userSessionDid = getSession(c)?.did;
    if (!userSessionDid) return c.json({ error: "Not authenticated" }, 403);
    try {
      const stats = await settingsService.getStats(userSessionDid);
      return c.json(stats);
    } catch (err) {
      ctx.logger.error({ err, did: userSessionDid }, "Failed to fetch user stats");
      return c.json({ error: "Failed to fetch user stats" }, 500);
    }
  });

  app.get("/pds-info", async (c) => {
    const userDid = getSession(c)?.did;
    if (!userDid) return c.json({ error: "Not authenticated" }, 403);
    const agent = await initializeAgentFromHonoSession(c, ctx);
    if (!agent) return c.json({ error: "Session expired" }, 401);
    try {
      const info = await settingsService.getPdsInfo(userDid, agent, ctx.idResolver);
      return c.json(info);
    } catch (err) {
      ctx.logger.error({ err, did: userDid }, "Failed to fetch PDS info");
      return c.json({ error: "Failed to fetch PDS info" }, 500);
    }
  });

  // POST /settings — every field optional; mirrors the Express validator's
  // .optional({ nullable: true }) semantics. Coerced booleans/strings only.
  const updateSchema = z.object({
    pdsSyncEnabled: z.boolean().optional(),
    imageTheme: z.string().min(1).nullable().optional(),
    inboxEnabled: z.boolean().optional(),
    profanityFilterEnabled: z.boolean().optional(),
    customPrompt: z.string().max(100).nullable().optional(),
    profileCardTheme: z.string().nullable().optional(),
    touchpointLocale: z.string().nullable().optional(),
  });

  app.post(
    "/settings",
    zValidator("json", updateSchema, (r, c) => {
      if (!r.success) return c.json({ errors: r.error.issues }, 400);
    }),
    async (c) => {
      const userSessionDid = getSession(c)?.did;
      if (!userSessionDid) return c.json({ error: "Not authenticated" }, 403);
      const body = c.req.valid("json");
      try {
        // Preserve `null` vs `undefined` semantics: the service treats null as
        // "clear this field" and undefined as "don't touch it" (the original
        // Express controller passed req.body values straight through). Coercing
        // null → undefined here would make clearing customPrompt/profileCardTheme/
        // touchpointLocale/imageTheme a no-op — the customise E2E caught this.
        const updatedSettings = await settingsService.updateSettings(userSessionDid, {
          pdsSyncEnabled: body.pdsSyncEnabled,
          // imageTheme is NOT nullable in the service (string only); coerce null
          // → undefined ("don't touch"), matching the original .notEmpty() guard.
          imageTheme: body.imageTheme ?? undefined,
          inboxEnabled: body.inboxEnabled,
          profanityFilterEnabled: body.profanityFilterEnabled,
          customPrompt: body.customPrompt,
          profileCardTheme: body.profileCardTheme,
          touchpointLocale: body.touchpointLocale,
        });
        ctx.logger.info(
          { did: userSessionDid, updatedFields: Object.keys(body ?? {}) },
          "Settings updated"
        );
        return c.json(updatedSettings);
      } catch (err) {
        ctx.logger.error({ err, did: userSessionDid }, "Failed to update user settings");
        return c.json({ error: "Failed to update user settings" }, 500);
      }
    }
  );

  return app;
}

/** Optional injected services — production omits this (uses real services); tests pass mocks. */
export interface NotificationDeps {
  notificationService?: NotificationService;
}

export function createNotificationHono(ctx: AppContext, deps: NotificationDeps = {}): Hono {
  const app = new Hono();
  const notificationService =
    deps.notificationService ?? new NotificationService(ctx.db, ctx.resolver, ctx.logger);

  app.get("/notifications/vapid-public-key", async (c) => {
    const vapidPublicKey = notificationService.getVapidPublicKey();
    if (!vapidPublicKey) return c.json({ error: "Web push not configured" }, 501);
    return c.json({ vapidPublicKey });
  });

  app.post(
    "/notifications/subscribe",
    zValidator(
      "json",
      z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string().min(1),
          auth: z.string().min(1),
        }),
      }),
      (r, c) => {
        if (!r.success) return c.json({ errors: r.error.issues }, 400);
      }
    ),
    async (c) => {
      const did = getSession(c)?.did;
      if (!did) return c.json({ error: "Not authenticated" }, 403);
      if (!notificationService.getVapidPublicKey()) {
        return c.json({ error: "Web push not configured" }, 501);
      }
      const { endpoint, keys } = c.req.valid("json");
      try {
        await notificationService.saveSubscription(did, endpoint, keys.p256dh, keys.auth);
        const session = getSession(c);
        const dids = getAccounts(session).map((account) => account.did);
        await notificationService.syncSubscriptionsAcrossAccounts(dids);
        ctx.logger.info({ did }, "Push subscription registered");
        return c.json({ ok: true }, 201);
      } catch (err) {
        ctx.logger.error({ err, did }, "Failed to save push subscription");
        return c.json({ error: "Failed to save subscription" }, 500);
      }
    }
  );

  app.delete(
    "/notifications/subscribe",
    zValidator("json", z.object({ endpoint: z.string().url() }), (r, c) => {
      if (!r.success) return c.json({ errors: r.error.issues }, 400);
    }),
    async (c) => {
      const did = getSession(c)?.did;
      if (!did) return c.json({ error: "Not authenticated" }, 403);
      const { endpoint } = c.req.valid("json");
      try {
        await notificationService.deleteSubscription(did, endpoint);
        ctx.logger.info({ did }, "Push subscription removed");
        return c.json({ ok: true });
      } catch (err) {
        ctx.logger.error({ err, did }, "Failed to delete push subscription");
        return c.json({ error: "Failed to delete subscription" }, 500);
      }
    }
  );

  return app;
}
