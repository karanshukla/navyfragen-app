// Hono auth-route handlers for the Express→Bun spike (#316).
//
// Ports the four auth-path handlers from controllers/auth-controller.ts to
// Hono's Context: login, session, logout, switchAccount. Business logic stays
// in AuthService (reused unchanged); only the req/res I/O moves from
// Express's (req, res) to Hono's (c).
//
// Validation moves from express-validator chains to @hono/zod-validator. The
// client already uses Zod v4, so this also consolidates the schema stack —
// one of the dep-reduction wins the spike is meant to quantify.

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
import { errorMessage } from "#/lib/errors";
import { env } from "#/lib/env";
import { pdsRegion } from "#/lib/pds-region";
import { AuthService } from "#/services/auth-service";
import { clearSession, getSession, setSession } from "./session-middleware";

import type { AppContext } from "#/index";
import type { AppSessionData } from "#/auth/session";

export function createAuthHono(ctx: AppContext): Hono {
  const app = new Hono();
  const service = new AuthService(ctx);

  // --- POST /login ---------------------------------------------------------
  // Zod v4: custom messages on .min() use { error: "..." }.
  const loginSchema = z.object({
    handle: z.string().min(1, { error: "Invalid handle" }).max(64),
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
        return c.json({ error: "invalid handle" }, 400);
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

  // --- GET /session --------------------------------------------------------
  app.get("/session", async (c) => {
    let session = getSession(c);
    if (!session?.did) {
      await clearSessionIfNeeded(c);
      ctx.logger.debug("No session cookie, returning not logged in");
      return c.json({ isLoggedIn: false, profile: null, did: null });
    }
    try {
      let did = session.did;
      let profile = await service.checkSession(did);

      // Active account expired — try to fall back to another remembered account.
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
        await clearSessionIfNeeded(c);
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
      await clearSessionIfNeeded(c);
      ctx.logger.error({ err }, "Error fetching profile");
      return c.json({ isLoggedIn: false, profile: null, did: null });
    }
  });

  // --- POST /logout --------------------------------------------------------
  app.post("/logout", async (c) => {
    const session = getSession(c);
    if (!session?.did) {
      return c.json({ error: "Not logged in" }, 400);
    }
    const did = session.did;
    try {
      await service.revokeSession(did);
      ctx.logger.info({ did }, "OAuth session revoked");
    } catch (err) {
      ctx.logger.error({ err, did }, "Failed to revoke OAuth session");
      return c.json({ error: "Failed to log out" }, 500);
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
    c.header("Set-Cookie", expireNfRegionCookie());
    return c.json({ message: "Logged out successfully" });
  });

  // --- POST /accounts/switch ----------------------------------------------
  const switchSchema = z.object({
    did: z.string().min(1, { error: "did is required" }).max(512),
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
        return c.json({ error: "Invalid DID format" }, 400);
      }
      const session = getSession(c);
      if (!session || !findAccount(session, did)) {
        ctx.logger.warn(
          { requestedDid: did, activeDid: session?.did },
          "Account switch denied: DID not in session"
        );
        return c.json({ error: "Account not found in session" }, 403);
      }
      try {
        const profile = await service.checkSession(did);
        if (!profile) {
          await setSession(
            c,
            mutateSession(session, (s) => removeAccount(s, did))
          );
          ctx.logger.info({ did }, "Switch failed, account session expired");
          return c.json({ error: "That account's session has expired" }, 401);
        }
        const updated = { ...session, did };
        await setSession(
          c,
          mutateSession(updated, (s) => upsertAccount(s, toAccountEntry(profile)))
        );
        ctx.logger.info({ did }, "Switched active account");
        return c.json({ success: true, did });
      } catch (err) {
        ctx.logger.error({ err, did }, "Failed to switch account");
        return c.json({ error: "Failed to switch account" }, 500);
      }
    }
  );

  // --- GET /client-metadata.json ------------------------------------------
  app.get("/client-metadata.json", (c) => c.json(ctx.oauthClient.clientMetadata));

  // --- GET /oauth/callback -------------------------------------------------
  // Bluesky redirects here after the user authorises. The query carries the
  // OAuth result; on success we persist the session and redirect the browser
  // to the client's /oauth_callback with a short-lived encrypted token.
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
      // Preserve any previously remembered accounts (add-account flow), then
      // make the newly authenticated account active.
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

  // --- POST /oauth/consume -------------------------------------------------
  // Exchanges the short-lived encrypted token (from /oauth/callback) for a real
  // session cookie. Also sets the nf-region routing hint for Caddy.
  app.post("/oauth/consume", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const oauthToken = body?.oauth_token;
    if (!oauthToken) {
      return c.json({ error: "Missing oauth_token" }, 400);
    }
    let did: string;
    try {
      did = service.decryptDid(oauthToken);
    } catch {
      ctx.logger.error("OAUTH_TOKEN_SECRET is not set");
      return c.json({ error: "Server misconfiguration" }, 500);
    }
    try {
      const user = await service.findUserByDid(did);
      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }
      const existing = getSession(c) ?? ({} as AppSessionData);
      await setSession(c, { ...existing, did });
      ctx.logger.info({ did }, "Session set from oauth_token");

      // PDS-region routing hint for Caddy. Non-fatal: a miss just means Caddy
      // falls back to the EU backend.
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
      return c.json({ error: "Invalid or expired token" }, 400);
    }
  });

  // --- POST /auth/e2e-login (E2E only, never in production) ----------------
  if (env.E2E_TESTING && env.NODE_ENV !== "production") {
    app.post(
      "/auth/e2e-login",
      zValidator(
        "json",
        z.object({
          identifier: z.string().min(1).max(100),
          password: z.string().min(1).max(200),
        }),
        (r, c) => {
          if (!r.success) return c.json({ errors: r.error.issues }, 400);
        }
      ),
      async (c) => {
        if (env.NODE_ENV === "production") {
          ctx.logger.error("E2E login attempted in production — request blocked");
          return c.json({ error: "E2E login is not available in production" }, 403);
        }
        const { identifier, password } = c.req.valid("json");
        const { AtpAgent } = await import("@atproto/api");
        const { setE2EAgent } = await import("#/auth/e2e-agent-store");
        const agent = new AtpAgent({ service: env.E2E_PDS_URL });
        await agent.login({ identifier, password });
        const did = agent.session?.did;
        if (!did) {
          return c.json({ error: "Login failed: no session DID returned" }, 401);
        }
        await ctx.db
          .insertInto("auth_session")
          .values({ key: did, session: "e2e" })
          .onConflict((oc) => oc.column("key").doUpdateSet({ session: "e2e" }))
          .execute();
        await service.createOrConfirmUserProfile(did);
        const handle = agent.session?.handle || identifier;
        setE2EAgent(did, agent, handle);
        const existing = getSession(c) ?? ({} as AppSessionData);
        await setSession(c, { ...existing, did });
        ctx.logger.info({ did }, "E2E login successful");
        return c.json({ success: true });
      }
    );
  }

  // --- helpers -------------------------------------------------------------

  /** Apply a mutation to a copy of the session (helpers mutate in place). */
  function mutateSession(session: AppSessionData, fn: (s: AppSessionData) => void): AppSessionData {
    const copy: AppSessionData = {
      did: session.did,
      accounts: session.accounts ? [...session.accounts] : undefined,
      oauthState: session.oauthState,
    };
    fn(copy);
    return copy;
  }

  async function clearSessionIfNeeded(c: Parameters<typeof clearSession>[0]): Promise<void> {
    clearSession(c);
  }

  /** The Express build clears the `nf-region` routing cookie on logout. */
  function expireNfRegionCookie(): string {
    return "nf-region=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }

  return app;
}
