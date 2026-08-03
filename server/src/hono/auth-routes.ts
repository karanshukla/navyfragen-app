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
import { isValidDid, isValidHandle } from "@atproto/syntax";

import {
  findAccount,
  getAccounts,
  removeAccount,
  toAccountEntry,
  upsertAccount,
} from "#/auth/session";
import { errorMessage } from "#/lib/errors";
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

  // pdsRegion is imported for parity with the OAuth consume handler in the
  // Express build; not exercised on this auth-path-only spike but kept so the
  // follow-up full rewrite doesn't have to rediscover the import.
  void pdsRegion;

  return app;
}
