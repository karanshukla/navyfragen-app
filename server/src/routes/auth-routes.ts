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
        // Additional logging for debugging in production
        ctx.logger.info(
          {
            handle,
            envPublicUrl: env.PUBLIC_URL,
            envClientUrl: env.CLIENT_URL,
          },
          "Starting OAuth authorize"
        );
        const url = await ctx.oauthClient.authorize(handle, {
          scope: "atproto transition:generic",
        });
        ctx.logger.info(
          {
            redirectUrl: url.toString(),
          },
          "OAuth authorize succeeded"
        );
        return res.json({ redirectUrl: url.toString() });
      } catch (err) {
        // Basic console.error for Railway as a test
        console.error("OAuth Authorize Failed (raw console.error):", err);
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
      const token = req.cookies?.auth_token;

      // Clear the auth_token cookie
      res.clearCookie("auth_token", {
        httpOnly: true,
        secure: env.NODE_ENV === "production", // Corrected to use env.NODE_ENV
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
      });

      // Also clear the iron session if it exists (if still used for other purposes)
      const ironSession = await getIronSession(req, res, {
        cookieName: "sid",
        password: env.COOKIE_SECRET,
        cookieOptions: {
          httpOnly: true,
          secure: true, // Assuming production or HTTPS for iron session as well
          sameSite: "none",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // Or 0 to clear immediately if that's the intent
        },
      });
      ironSession.destroy();

      // Revoke the OAuth session via the client
      if (token) {
        try {
          const did = Buffer.from(token, "base64").toString("ascii");
          await ctx.oauthClient.revoke(did); // This will also delete it from storage
          ctx.logger.info(
            { did },
            "OAuth session revoked and deleted from storage."
          );
        } catch (err) {
          ctx.logger.warn(
            { err, did: Buffer.from(token, "base64").toString("ascii") },
            "Failed to revoke OAuth session on logout. It might have been already invalid or removed from storage."
          );
        }
      }

      return res.status(200).json({ message: "Logged out successfully" });
    })
  );

  // Session check
  router.get(
    "/session",
    handler(async (req: express.Request, res: express.Response) => {
      // Check for token in cookie first, then fall back to query param or Authorization header
      const token =
        req.cookies?.auth_token ||
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
        const did = callbackResult.session.did;

        // Add user to user_profile table if they don't exist
        try {
          await ctx.db
            .insertInto("user_profile")
            .values({
              did: did,
              createdAt: new Date().toISOString(),
            })
            .onConflict((oc) => oc.column("did").doNothing()) // If user already exists, do nothing
            .execute();
          ctx.logger.info({ did }, "User profile entry created or confirmed.");
        } catch (dbErr) {
          ctx.logger.error(
            { err: dbErr, did },
            "Failed to create or confirm user profile entry."
          );
        }

        const token = Buffer.from(did).toString("base64");
        res.cookie("auth_token", token, {
          httpOnly: true,
          secure: env.NODE_ENV === "production",
          sameSite: env.NODE_ENV === "production" ? "none" : "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: "/",
        });
        // For local dev, also include token in redirect URL for localStorage fallback
        if (env.NODE_ENV !== "production") {
          return res.redirect(
            `${env.CLIENT_URL}/messages?token=${encodeURIComponent(token)}`
          );
        }
        // Production: normal redirect
        return res.redirect(`${env.CLIENT_URL}/messages`);
      } catch (err) {
        ctx.logger.error(
          {
            err: err instanceof Error ? err.stack || err.message : err,
            params: Object.fromEntries(params.entries()),
          },
          "oauth callback failed"
        );
        return res.redirect(`${env.CLIENT_URL}/login?error=oauth_failed`);
      }
    })
  );

  // Local dev: set cookie via direct API call
  router.post(
    "/set-cookie",
    handler(async (req: express.Request, res: express.Response) => {
      const token = req.body.token || req.query.token;
      if (!token) {
        return res.status(400).json({ error: "Missing token" });
      }
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });
      return res.json({ success: true });
    })
  );
  return router;
}
