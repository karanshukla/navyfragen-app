import express from "express";
import { body, validationResult } from "express-validator";
import { isValidHandle } from "@atproto/syntax";
import { OAuthResolverError } from "@atproto/oauth-client-node";
import { getIronSession } from "iron-session";
import type { AppContext } from "../index";
import { env } from "../lib/env";

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
    handler(async (req, res) => {
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
        ctx.logger.error({ err }, "oauth authorize failed");
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
    handler(async (req, res) => {
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
      await session.destroy();
      return res.status(200).json({ message: "Logged out successfully" });
    })
  );

  // Session check
  router.get(
    "/session",
    handler(async (req, res) => {
      // ...existing code from /api/session...
    })
  );

  // OAuth metadata
  router.get(
    "/client-metadata.json",
    handler((_req, res) => {
      return res.json(ctx.oauthClient.clientMetadata);
    })
  );

  // OAuth callback
  router.get(
    "/oauth/callback",
    handler(async (req, res) => {
      // ...existing code from /api/oauth/callback...
    })
  );

  // Debug endpoint
  router.get(
    "/debug-cookies",
    handler(async (req, res) => {
      // ...existing code from /api/debug-cookies...
    })
  );

  return router;
}
