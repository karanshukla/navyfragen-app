import express from "express";
import { body, validationResult } from "express-validator";
import { isValidHandle } from "@atproto/syntax";
import { OAuthResolverError } from "@atproto/oauth-client-node";
import { getIronSession } from "iron-session";
import type { AppContext } from "../index";
import { env } from "../lib/env";
import { IncomingMessage, ServerResponse } from "http";

export function authRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  const router = express.Router();

  // Login handler
  router.post(
    "/login",
    body("handle")
      .isString()
      .isLength({ min: 1, max: 64 })
      .withMessage("Invalid handle"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      const handle = req.body?.handle;
      if (typeof handle !== "string" || !isValidHandle(handle)) {
        return res.status(400).json({ error: "invalid handle" });
      }
      try {
        const url = await ctx.oauthClient.authorize(handle, {
          scope: "atproto transition:generic",
        });
        return res.json({ redirectUrl: url.toString() });
      } catch (err) {
        // Log the full error, including stack trace if present
        ctx.logger.error(
          {
            err,
            stack: err instanceof Error ? err.stack : undefined,
            message: err instanceof Error ? err.message : String(err),
          },
          "oauth authorize failed: "
        );
        const message =
          err instanceof OAuthResolverError
            ? err.message
            : "couldn't initiate login";
        return res.status(500).json({ error: message });
      }
    })
  );

  // Logout handler
  router.post(
    "/logout",
    handler(async (req: express.Request, res: express.Response) => {
      const session = await getIronSession(req, res, {
        cookieName: "sid",
        password: env.COOKIE_SECRET,
        cookieOptions: {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        },
      });
      session.destroy();
      return res.status(200).json({ message: "Logged out successfully" });
    })
  );

  // Session check
  router.get(
    "/session",
    handler(async (req: express.Request, res: express.Response) => {
      // Check for token in query param or Authorization header
      const token =
        (req.query.token as string) ||
        req.headers.authorization?.replace("Bearer ", "") ||
        null;

      if (!token) {
        return res.json({ isLoggedIn: false, profile: null, did: null });
      }

      try {
        // Decode DID from token
        const did = Buffer.from(token, "base64").toString("ascii");

        // Check if session exists in DB
        const dbSession = await ctx.db
          .selectFrom("auth_session")
          .selectAll()
          .where("key", "=", did)
          .executeTakeFirst();

        if (!dbSession) {
          return res.json({ isLoggedIn: false, profile: null, did: null });
        }

        // Try to restore the session using the OAuth client
        let agent;
        let authenticated = false;
        try {
          const oauthSession = await ctx.oauthClient.restore(did);
          if (oauthSession) {
            agent = new (require("@atproto/api").Agent)(oauthSession);
            // Test if the session is valid by checking assertDid
            const agentDid = agent.assertDid;
            authenticated = true;
          }
        } catch (err) {
          // Could not restore authenticated session, fall back to public profile
        }

        // If authenticated, fetch profile with auth (can see private info)
        if (authenticated && agent) {
          try {
            const profileResponse = await agent.com.atproto.repo.getRecord({
              repo: did,
              collection: "app.bsky.actor.profile",
              rkey: "self",
            });
            if (
              profileResponse?.data &&
              require("../../lexicon/types/app/bsky/actor/profile").isRecord(
                profileResponse.data.value
              )
            ) {
              return res.json({
                isLoggedIn: true,
                profile: profileResponse.data.value,
                did,
              });
            }
          } catch (profileErr) {
            // Authenticated profile fetch failed, fall back to public
          }
        }

        // If not authenticated, or profile fetch failed, fetch public profile
        try {
          const AtpAgent = require("@atproto/api").AtpAgent;
          const agent = new AtpAgent({ service: "https://api.bsky.app" });
          const profileResponse = await agent.getProfile({ actor: did });
          if (profileResponse.success) {
            return res.json({
              isLoggedIn: true,
              profile: profileResponse.data,
              did,
            });
          } else {
            return res.json({
              isLoggedIn: true,
              profile: null,
              did,
            });
          }
        } catch (profileErr) {
          return res.json({
            isLoggedIn: true,
            profile: null,
            did,
          });
        }
      } catch (err) {
        ctx.logger.error({ err }, "Failed to process session token");
        return res.json({ isLoggedIn: false, profile: null, did: null });
      }
    })
  );

  // OAuth metadata
  router.get(
    "/client-metadata.json",
    handler((req: express.Request, res: express.Response) => {
      return res.json(ctx.oauthClient.clientMetadata);
    })
  );

  // OAuth callback
  router.get(
    "/oauth/callback",
    handler(async (req: express.Request, res: express.Response) => {
      const params = new URLSearchParams(req.originalUrl.split("?")[1]);
      try {
        const callbackResult = await ctx.oauthClient.callback(params);
        const token = Buffer.from(callbackResult.session.did).toString(
          "base64"
        );
        // Redirect to client with token in query param
        return res.redirect(`${env.CLIENT_URL}/messages?token=${token}`);
      } catch (err) {
        ctx.logger.error(
          {
            err: err instanceof Error ? err.stack || err.message : err,
            params: Object.fromEntries(params.entries()),
          },
          "oauth callback failed"
        );
        // Redirect to login page with error
        return res.redirect(`${env.CLIENT_URL}/login?error=oauth_failed`);
      }
    })
  );

  // Debug endpoint
  router.get(
    "/debug-cookies",
    handler(async (req: express.Request, res: express.Response) => {
      // Check for token in query param or Authorization header
      const token =
        (req.query.token as string) ||
        req.headers.authorization?.replace("Bearer ", "") ||
        null;

      let authStatus = "Not authenticated";
      let userData = null;

      if (token) {
        try {
          // Decode DID from token
          const did = Buffer.from(token, "base64").toString("ascii");

          // Get session from DB
          const savedSession = await ctx.db
            .selectFrom("auth_session")
            .selectAll()
            .where("key", "=", did)
            .executeTakeFirst();

          if (savedSession) {
            authStatus = "Authenticated";
            userData = { did };
          }
        } catch (err) {
          ctx.logger.error({ err }, "Failed to verify token");
        }
      }

      return res.json({
        authStatus,
        userData,
        token: token ? "Present" : "Missing",
        message: "Auth check complete",
      });
    })
  );

  return router;
}
