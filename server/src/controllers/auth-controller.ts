import { Request, Response } from "express";
import { isValidHandle } from "@atproto/syntax";
import { env } from "../lib/env";
import type { AppContext } from "../index";
import { AuthService } from "../services/auth-service";

export class AuthController {
  private service: AuthService;
  constructor(private ctx: AppContext) {
    this.service = new AuthService(ctx);
  }

  async login(req: Request, res: Response) {
    const handle = req.body?.handle;
    if (typeof handle !== "string" || !isValidHandle(handle)) {
      return res.status(400).json({ error: "invalid handle" });
    }
    try {
      this.ctx.logger.info(
        { handle, envPublicUrl: env.PUBLIC_URL, envClientUrl: env.CLIENT_URL },
        "Starting OAuth authorize"
      );
      const redirectUrl = await this.service.getOAuthRedirectUrl(handle);
      this.ctx.logger.info({ redirectUrl }, "OAuth authorize succeeded");
      return res.json({ redirectUrl });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "couldn't initiate login" });
    }
  }

  async logout(req: Request, res: Response) {
    if (!req.session?.did) {
      return res.status(400).json({ error: "Not logged in" });
    }
    try {
      await this.service.revokeSession(req.session.did);
      this.ctx.logger.info({ did: req.session.did }, "OAuth session revoked");
    } catch (err) {
      this.ctx.logger.error(
        { err, did: req.session.did },
        "Failed to revoke OAuth session"
      );
      return res.status(500).json({ error: "Failed to log out" });
    }
    req.session = null;
    return res.status(200).json({ message: "Logged out successfully" });
  }

  async session(req: Request, res: Response) {
    if (!req.session?.did) {
      req.session = null;
      this.ctx.logger.error("No session cookie found, user is not logged in");
      return res.json({ isLoggedIn: false, profile: null, did: null });
    }
    try {
      const did = req.session?.did;
      const profile = await this.service.checkSession(did, req);
      if (!profile) {
        req.session = null;
        return res.json({ isLoggedIn: false, profile: null, did: null });
      }
      return res.json({ isLoggedIn: true, profile, did });
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
        this.ctx.logger.info(
          { did },
          "User profile entry created or confirmed."
        );
      } catch (dbErr) {
        this.ctx.logger.error(
          { err: dbErr, did },
          "Failed to create or confirm user profile entry."
        );
      }
      req.session = { did };
      this.ctx.logger.info(
        { did },
        "OAuth callback successful, session created"
      );
      let token: string;
      try {
        token = this.service.encryptDid(did);
      } catch (e: any) {
        this.ctx.logger.error("OAUTH_TOKEN_SECRET is not set");
        return res.redirect(`${env.CLIENT_URL}/login?error=server_config`);
      }
      return res.redirect(
        `${env.CLIENT_URL}/oauth_callback?oauth_token=${token}`
      );
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
      req.session = { did };
      this.ctx.logger.info({ did }, "Session set from oauth_token");
      return res.json({ success: true });
    } catch (err) {
      this.ctx.logger.error({ err }, "Failed to consume oauth_token");
      return res.status(400).json({ error: "Invalid or expired token" });
    }
  }
}
