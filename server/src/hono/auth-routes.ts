import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { isValidDid, isValidHandle } from "@atproto/syntax";

import {
  findAccount,
  getAccounts,
  removeAccount,
  toAccountEntry,
  upsertAccount,
} from "#/auth/session";
import { errorBody, errorMessage } from "#/lib/errors";
import { env } from "#/lib/env";
import { pdsRegion } from "#/lib/pds-region";
import { AuthService } from "#/services/auth-service";
import { NotificationService } from "#/services/notification-service";
import { clearSession, getSession, setSession } from "./session-middleware";
import { createE2EAuthHono } from "./e2e-auth-routes";

import type { AppContext } from "#/index";
import type { AppSessionData } from "#/auth/session";

export interface AuthDeps {
  service?: AuthService;
  notificationService?: NotificationService;
}

export function createAuthHono(ctx: AppContext, deps: AuthDeps = {}): Hono {
  const app = new Hono();
  const service = deps.service ?? new AuthService(ctx);
  const notificationService =
    deps.notificationService ?? new NotificationService(ctx.db, ctx.resolver, ctx.logger);

  const loginSchema = z.object({
    handle: z.string().min(1, { error: "INVALID_HANDLE" }).max(64),
  });

  app.post(
    "/login",
    zValidator("json", loginSchema, (result, c) => {
      if (!result.success) {
        return c.json({ errors: result.error.issues }, 400);
      }
    }),
    async (c) => {
      const { handle } = c.req.valid("json");
      if (!isValidHandle(handle)) {
        return c.json(errorBody("INVALID_HANDLE", "invalid handle"), 400);
      }
      try {
        ctx.logger.info({ handle }, "Starting OAuth authorize");
        const redirectUrl = await service.getOAuthRedirectUrl(handle);
        ctx.logger.info({ redirectUrl }, "OAuth authorize succeeded");
        return c.json({ redirectUrl });
      } catch (err: unknown) {
        return c.json({ error: errorMessage(err) || "couldn't initiate login" }, 500);
      }
    }
  );

  app.get("/session", async (c) => {
    let session = getSession(c);
    if (!session?.did) {
      clearSession(c);
      ctx.logger.debug("No session cookie, returning not logged in");
      return c.json({ isLoggedIn: false, profile: null, did: null });
    }
    try {
      let did = session.did;
      let profile = await service.checkSession(did);

      if (!profile) {
        session = mutateSession(session, (s) => removeAccount(s, did));
        const fallback = getAccounts(session)[0];
        if (fallback) {
          did = fallback.did;
          const updated = { ...session, did };
          await setSession(c, updated);
          session = updated;
          profile = await service.checkSession(did);
          if (profile) {
            const p = profile;
            await setSession(
              c,
              mutateSession(session, (s) => upsertAccount(s, toAccountEntry(p)))
            );
          } else {
            await setSession(
              c,
              mutateSession(session, (s) => removeAccount(s, did))
            );
          }
        }
      } else {
        const p = profile;
        await setSession(
          c,
          mutateSession(session, (s) => upsertAccount(s, toAccountEntry(p)))
        );
      }

      if (!profile) {
        clearSession(c);
        return c.json({ isLoggedIn: false, profile: null, did: null });
      }

      const finalSession = getSession(c) as AppSessionData;
      return c.json({
        isLoggedIn: true,
        profile,
        did,
        accounts: getAccounts(finalSession),
      });
    } catch (err) {
      clearSession(c);
      ctx.logger.error({ err }, "Error fetching profile");
      return c.json({ isLoggedIn: false, profile: null, did: null });
    }
  });

  app.post("/logout", async (c) => {
    const session = getSession(c);
    if (!session?.did) {
      return c.json(errorBody("NOT_AUTHENTICATED", "Not logged in"), 400);
    }
    const did = session.did;
    try {
      await service.revokeSession(did);
      ctx.logger.info({ did }, "OAuth session revoked");
    } catch (err) {
      ctx.logger.error({ err, did }, "Failed to revoke OAuth session");
      return c.json(errorBody("LOGOUT_FAILED", "Failed to log out"), 500);
    }
    const next = mutateSession(session, (s) => removeAccount(s, did));
    const remaining = getAccounts(next);
    if (remaining.length > 0) {
      const switched = { ...next, did: remaining[0].did };
      await setSession(c, switched);
      ctx.logger.info({ did: switched.did }, "Switched active account after logout");
      return c.json({ message: "Logged out, switched account", switched: true });
    }
    clearSession(c);
    // Appended, not set: clearSession already wrote nf-session's expiry and a
    // non-appending c.header would clobber that Set-Cookie header.
    c.header("Set-Cookie", expireNfRegionCookie(), { append: true });
    return c.json({ message: "Logged out successfully" });
  });

  const switchSchema = z.object({
    did: z.string().min(1, { error: "DID_REQUIRED" }).max(512),
  });

  app.post(
    "/accounts/switch",
    zValidator("json", switchSchema, (result, c) => {
      if (!result.success) {
        return c.json({ errors: result.error.issues }, 400);
      }
    }),
    async (c) => {
      const { did } = c.req.valid("json");
      if (!isValidDid(did)) {
        return c.json(errorBody("INVALID_DID", "Invalid DID format"), 400);
      }
      const session = getSession(c);
      if (!session || !findAccount(session, did)) {
        ctx.logger.warn(
          { requestedDid: did, activeDid: session?.did },
          "Account switch denied: DID not in session"
        );
        return c.json(errorBody("NOT_AUTHENTICATED", "Account not found in session"), 403);
      }
      try {
        const profile = await service.checkSession(did);
        if (!profile) {
          await setSession(
            c,
            mutateSession(session, (s) => removeAccount(s, did))
          );
          ctx.logger.info({ did }, "Switch failed, account session expired");
          return c.json(
            errorBody("ACCOUNT_SESSION_EXPIRED", "That account's session has expired"),
            401
          );
        }
        const updated = { ...session, did };
        await setSession(
          c,
          mutateSession(updated, (s) => upsertAccount(s, toAccountEntry(profile)))
        );
        ctx.logger.info({ did }, "Switched active account");
        // Fire-and-forget — the switch response must not wait on this.
        notificationService
          .syncSubscriptionsAcrossAccounts(getAccounts(updated).map((a) => a.did))
          .catch((err) =>
            ctx.logger.error({ err, did }, "Failed to sync push subscriptions across accounts")
          );
        return c.json({ success: true, did });
      } catch (err) {
        ctx.logger.error({ err, did }, "Failed to switch account");
        return c.json(errorBody("ACCOUNT_SWITCH_FAILED", "Failed to switch account"), 500);
      }
    }
  );

  app.get("/client-metadata.json", (c) => c.json(ctx.oauthClient.clientMetadata));

  app.get("/oauth/callback", async (c) => {
    const params = new URLSearchParams(c.req.url.split("?")[1] ?? "");
    try {
      const callbackResult = await ctx.oauthClient.callback(params);
      const did = callbackResult.session.did;
      try {
        await service.createOrConfirmUserProfile(did);
        ctx.logger.info({ did }, "User profile entry created or confirmed.");
      } catch (dbErr) {
        ctx.logger.error({ err: dbErr, did }, "Failed to create or confirm user profile entry.");
      }
      const existing = getSession(c) ?? ({} as AppSessionData);
      await setSession(c, { ...existing, did });
      ctx.logger.info({ did }, "OAuth callback successful, session created");
      let token: string;
      try {
        token = service.encryptDid(did);
      } catch {
        ctx.logger.error("OAUTH_TOKEN_SECRET is not set");
        return c.redirect(`${env.CLIENT_URL}/login?error=server_config`);
      }
      return c.redirect(`${env.CLIENT_URL}/oauth_callback?oauth_token=${token}`);
    } catch (err) {
      ctx.logger.error(
        {
          err: err instanceof Error ? err.stack || err.message : err,
          params: Object.fromEntries(params.entries()),
        },
        "oauth callback failed"
      );
      return c.redirect(`${env.CLIENT_URL}/login?error=oauth_failed`);
    }
  });

  app.post("/oauth/consume", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const oauthToken = body?.oauth_token;
    if (!oauthToken) {
      return c.json(errorBody("MISSING_OAUTH_TOKEN", "Missing oauth_token"), 400);
    }
    let did: string;
    try {
      did = service.decryptDid(oauthToken);
    } catch {
      ctx.logger.error("OAUTH_TOKEN_SECRET is not set");
      return c.json(errorBody("SERVER_MISCONFIGURED", "Server misconfiguration"), 500);
    }
    try {
      const user = await service.findUserByDid(did);
      if (!user) {
        return c.json(errorBody("USER_NOT_FOUND", "User not found"), 404);
      }
      const existing = getSession(c) ?? ({} as AppSessionData);
      await setSession(c, { ...existing, did });
      ctx.logger.info({ did }, "Session set from oauth_token");

      // Non-fatal: without the hint Caddy falls back to the EU backend.
      try {
        const atData = await ctx.idResolver.did.resolveAtprotoData(did);
        const region = pdsRegion(atData.pds);
        setCookie(c, "nf-region", region, {
          maxAge: 14 * 24 * 60 * 60,
          httpOnly: false,
          sameSite: "Lax",
          path: "/",
        });
        ctx.logger.info({ did, pds: atData.pds, region }, "PDS region resolved");
      } catch (regionErr) {
        ctx.logger.warn(
          { err: regionErr, did },
          "PDS region resolution failed, skipping nf-region cookie"
        );
      }
      return c.json({ success: true });
    } catch (err) {
      ctx.logger.error({ err }, "Failed to consume oauth_token");
      return c.json(errorBody("INVALID_OAUTH_TOKEN", "Invalid or expired token"), 400);
    }
  });

  const e2eSubApp =
    env.E2E_TESTING && env.NODE_ENV !== "production" ? createE2EAuthHono(ctx, service) : null;
  if (e2eSubApp) app.route("/", e2eSubApp);

  function mutateSession(session: AppSessionData, fn: (s: AppSessionData) => void): AppSessionData {
    const copy: AppSessionData = {
      did: session.did,
      accounts: session.accounts ? [...session.accounts] : undefined,
      oauthState: session.oauthState,
    };
    fn(copy);
    return copy;
  }

  function expireNfRegionCookie(): string {
    return "nf-region=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }

  return app;
}
