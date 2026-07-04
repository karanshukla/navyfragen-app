/* v8 ignore start */
import { isValidDid, isValidHandle } from "@atproto/syntax";
import { Request, Response } from "express";

import {
  findAccount,
  getAccounts,
  removeAccount,
  toAccountEntry,
  upsertAccount,
} from "../auth/session";
import { env } from "../lib/env";
import { pdsRegion } from "../lib/pds-region";
import { AuthService } from "../services/auth-service";
import { NotificationService } from "../services/notification-service";

import type { AppContext } from "../index";

export class AuthController {
  private service: AuthService;
  private notificationService: NotificationService;
  constructor(private ctx: AppContext) {
    this.service = new AuthService(ctx);
    this.notificationService = new NotificationService(ctx.db, ctx.resolver, ctx.logger);
  }
  /* v8 ignore stop */

  async login(req: Request, res: Response) {
    const handle = req.body?.handle;
    if (typeof handle !== "string" || !isValidHandle(handle)) {
      return res.status(400).json({ error: "invalid handle" });
    }
    try {
      this.ctx.logger.info({ handle }, "Starting OAuth authorize");
      const redirectUrl = await this.service.getOAuthRedirectUrl(handle);
      this.ctx.logger.info({ redirectUrl }, "OAuth authorize succeeded");
      return res.json({ redirectUrl });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "couldn't initiate login" });
    }
  }

  async logout(req: Request, res: Response) {
    if (!req.session?.did) {
      return res.status(400).json({ error: "Not logged in" });
    }
    const did = req.session.did;
    try {
      await this.service.revokeSession(did);
      this.ctx.logger.info({ did }, "OAuth session revoked");
    } catch (err) {
      this.ctx.logger.error({ err, did }, "Failed to revoke OAuth session");
      return res.status(500).json({ error: "Failed to log out" });
    }
    // Drop the signed-out account from the remembered list.
    removeAccount(req.session, did);
    // If other accounts remain, switch to the first rather than ending the
    // session entirely. Single-account users get the original full-logout behaviour.
    const remaining = getAccounts(req.session);
    if (remaining.length > 0) {
      req.session.did = remaining[0].did;
      this.ctx.logger.info({ did: req.session.did }, "Switched active account after logout");
      return res.status(200).json({ message: "Logged out, switched account", switched: true });
    }
    req.session = null;
    res.clearCookie("nf-region", { path: "/" });
    return res.status(200).json({ message: "Logged out successfully" });
  }

  async session(req: Request, res: Response) {
    if (!req.session?.did) {
      req.session = null;
      this.ctx.logger.debug("No session cookie, returning not logged in");
      return res.json({ isLoggedIn: false, profile: null, did: null });
    }
    try {
      let did = req.session.did;
      let profile = await this.service.checkSession(did);

      // Active account's token is no longer valid — drop it and try to fall
      // back to another remembered account before giving up entirely.
      if (!profile) {
        removeAccount(req.session, did);
        const fallback = getAccounts(req.session)[0];
        if (fallback) {
          did = fallback.did;
          req.session.did = did;
          profile = await this.service.checkSession(did);
          if (profile) {
            upsertAccount(req.session, toAccountEntry(profile));
          } else {
            removeAccount(req.session, did);
          }
        }
      } else {
        // Refresh the active account's cached entry (handle/avatar may have changed).
        upsertAccount(req.session, toAccountEntry(profile));
      }

      if (!profile) {
        req.session = null;
        return res.json({ isLoggedIn: false, profile: null, did: null });
      }

      return res.json({
        isLoggedIn: true,
        profile,
        did: req.session.did,
        accounts: getAccounts(req.session),
      });
    } catch (err) {
      req.session = null;
      this.ctx.logger.error({ err }, "Error fetching profile");
      return res.json({ isLoggedIn: false, profile: null, did: null });
    }
  }

  clientMetadata(req: Request, res: Response) {
    return res.json(this.ctx.oauthClient.clientMetadata);
  }

  async oauthCallback(req: Request, res: Response) {
    const params = new URLSearchParams(req.originalUrl.split("?")[1]);
    try {
      const callbackResult = await this.ctx.oauthClient.callback(params);
      const did = callbackResult.session.did;
      try {
        await this.service.createOrConfirmUserProfile(did);
        this.ctx.logger.info({ did }, "User profile entry created or confirmed.");
      } catch (dbErr) {
        this.ctx.logger.error(
          { err: dbErr, did },
          "Failed to create or confirm user profile entry."
        );
      }
      req.session = req.session ?? {};
      // Make the newly authenticated account active. Existing remembered
      // accounts are preserved so this doubles as "add account".
      req.session.did = did;
      this.ctx.logger.info({ did }, "OAuth callback successful, session created");
      let token: string;
      try {
        token = this.service.encryptDid(did);
      } catch (e: any) {
        this.ctx.logger.error("OAUTH_TOKEN_SECRET is not set");
        return res.redirect(`${env.CLIENT_URL}/login?error=server_config`);
      }
      return res.redirect(`${env.CLIENT_URL}/oauth_callback?oauth_token=${token}`);
    } catch (err) {
      this.ctx.logger.error(
        {
          err: err instanceof Error ? err.stack || err.message : err,
          params: Object.fromEntries(params.entries()),
        },
        "oauth callback failed"
      );
      return res.redirect(`${env.CLIENT_URL}/login?error=oauth_failed`);
    }
  }

  async oauthConsume(req: Request, res: Response) {
    const { oauth_token } = req.body;
    if (!oauth_token) {
      return res.status(400).json({ error: "Missing oauth_token" });
    }
    let did: string;
    try {
      did = this.service.decryptDid(oauth_token);
    } catch (e: any) {
      this.ctx.logger.error("OAUTH_TOKEN_SECRET is not set");
      return res.status(500).json({ error: "Server misconfiguration" });
    }
    try {
      const user = await this.service.findUserByDid(did);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      req.session = req.session ?? {};
      // Preserve any previously remembered accounts (add-account flow).
      req.session.did = did;
      this.ctx.logger.info({ did }, "Session set from oauth_token");

      // Set a routing hint cookie so Caddy can forward subsequent requests to
      // the backend closest to the user's PDS (minimises PDS↔backend latency).
      // Non-fatal: missing cookie means Caddy falls back to the EU backend.
      try {
        const atData = await this.ctx.idResolver.did.resolveAtprotoData(did);
        const region = pdsRegion(atData.pds);
        res.cookie("nf-region", region, {
          maxAge: 14 * 24 * 60 * 60 * 1000,
          httpOnly: false,
          sameSite: "lax",
          path: "/",
        });
        this.ctx.logger.info({ did, pds: atData.pds, region }, "PDS region resolved");
      } catch (regionErr) {
        this.ctx.logger.warn(
          { err: regionErr, did },
          "PDS region resolution failed, skipping nf-region cookie"
        );
      }

      return res.json({ success: true });
    } catch (err) {
      this.ctx.logger.error({ err }, "Failed to consume oauth_token");
      return res.status(400).json({ error: "Invalid or expired token" });
    }
  }

  /**
   * Switches the active account to a previously remembered DID.
   *
   * The OAuth tokens for every remembered account already live in the DB, so
   * switching is a cheap pointer flip — no OAuth round-trip required. We still
   * verify the target account's session is restorable; if it has expired the
   * account is dropped from the remembered list.
   *
   * SECURITY: the only DIDs that can be switched to are those already present
   * in the signed cookie-session's `accounts` array. That array is populated
   * exclusively server-side after a successful Bluesky OAuth callback, and the
   * cookie is HMAC-signed with COOKIE_SECRET — so it cannot be forged or
   * extended client-side. The `findAccount` check is the authoritative gate;
   * DID format validation below is defense-in-depth only.
   */
  async switchAccount(req: Request, res: Response) {
    const did = req.body?.did;
    if (typeof did !== "string" || !did) {
      return res.status(400).json({ error: "did is required" });
    }
    // Defense in depth: reject malformed DIDs before touching the DB, even
    // though findAccount() below would also reject unknown DIDs.
    if (!isValidDid(did)) {
      return res.status(400).json({ error: "Invalid DID format" });
    }
    // findAccount returns undefined for a null session, so reaching here proves
    // the session is present and the DID is genuinely remembered. Capturing the
    // narrowed reference avoids repeated null-checks below.
    const session = req.session;
    if (!session || !findAccount(session, did)) {
      // A request to switch to a DID not in the session is suspicious — it
      // either means a tampered cookie (should be impossible) or a probing
      // attempt. Log it with the caller's active DID for auditing.
      this.ctx.logger.warn(
        { requestedDid: did, activeDid: session?.did },
        "Account switch denied: DID not in session"
      );
      return res.status(403).json({ error: "Account not found in session" });
    }
    try {
      const profile = await this.service.checkSession(did);
      if (!profile) {
        // Token for that account is no longer valid — stop remembering it.
        removeAccount(session, did);
        this.ctx.logger.info({ did }, "Switch failed, account session expired");
        return res.status(401).json({ error: "That account's session has expired" });
      }
      session.did = did;
      upsertAccount(session, toAccountEntry(profile));
      this.ctx.logger.info({ did }, "Switched active account");
      // Fire-and-forget: if this device already has push enabled for another
      // remembered account, extend it to the one just switched to. Never
      // block the switch response on this.
      this.notificationService
        .syncSubscriptionsAcrossAccounts(getAccounts(session).map((account) => account.did))
        .catch((err) =>
          this.ctx.logger.error({ err, did }, "Failed to sync push subscriptions across accounts")
        );
      return res.json({ success: true, did });
    } catch (err) {
      this.ctx.logger.error({ err, did }, "Failed to switch account");
      return res.status(500).json({ error: "Failed to switch account" });
    }
  }
  /* v8 ignore next 1 */
}
