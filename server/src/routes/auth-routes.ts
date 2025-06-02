import express from "express";
import { body } from "express-validator";
import { isValidHandle } from "@atproto/syntax";
import { OAuthResolverError } from "@atproto/oauth-client-node";
import type { AppContext } from "../index";
import { env } from "../lib/env";
import { initializeAgentFromSession } from "#/auth/session-agent";
import type { Record as BskyProfileRecord } from "../lexicon/types/app/bsky/actor/profile";
import crypto from "crypto";

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
      // Revoke the OAuth sesssion first
      if (!req.session?.did) {
        return res.status(400).json({ error: "Not logged in" });
      }
      try {
        await ctx.oauthClient.revoke(req.session.did);
        ctx.logger.info({ did: req.session.did }, "OAuth session revoked");
      } catch (err) {
        ctx.logger.error(
          { err, did: req.session.did },
          "Failed to revoke OAuth session"
        );
        return res.status(500).json({ error: "Failed to log out" });
      }

      req.session = null; // Clear the cookies

      return res.status(200).json({ message: "Logged out successfully" });
    })
  );

  // Session check, we want to keep the client authenticated with ATProto
  router.get(
    "/session",
    handler(async (req: express.Request, res: express.Response) => {
      if (!req.session?.did) {
        ctx.logger.error("No session cookie found, user is not logged in");
        return res.json({ isLoggedIn: false, profile: null, did: null });
      }

      try {
        const did = req.session?.did;

        // Check if session exists in DB
        const dbSession = await ctx.db
          .selectFrom("auth_session")
          .selectAll()
          .where("key", "=", did)
          .executeTakeFirst();

        if (!dbSession) {
          ctx.logger.error(
            { did },
            "Session not found in database, user is not logged in"
          );
          return res.json({ isLoggedIn: false, profile: null, did: null });
        }

        // Fetch the profile using the authenticated agent
        const agent = await initializeAgentFromSession(req, ctx);
        if (!agent) {
          ctx.logger.warn(
            { did },
            "No agent could be initialized from session"
          );
          return res.json({ isLoggedIn: false, profile: null, did: null });
        }
        const response = await agent.getProfile({ actor: did });
        const data = response?.data as BskyProfileRecord;
        if (!data) {
          ctx.logger.error({ did }, "No profile data found for user");
          return res.json({ isLoggedIn: false, profile: null, did: null });
        }
        const profile: Partial<BskyProfileRecord> = {
          did: data.did,
          handle: data.handle,
          displayName: data.displayName || "",
          description: data.description || "",
          avatar: data.avatar || undefined,
          banner: data.banner || undefined,
          createdAt: data.createdAt,
        };
        return res.json({ isLoggedIn: true, profile, did });
      } catch (err) {
        ctx.logger.error({ err }, "Error fetching profile");
        return res.json({ isLoggedIn: false, profile: null, did: null });
      }
    })
  );

  // OAuth metadata, just for compatibility
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

        req.session = {
          did: did,
        };
        // encrypt the DID and send it to the oauth_callback in React
        ctx.logger.info({ did }, "OAuth callback successful, session created");

        const secret = env.OAUTH_TOKEN_SECRET;
        if (!secret) {
          ctx.logger.error("OAUTH_TOKEN_SECRET is not set");
          return res.redirect(`${env.CLIENT_URL}/login?error=server_config`);
        }
        const encryptedDid = encryptDid(did, secret);

        const token = encodeURIComponent(encryptedDid);
        return res.redirect(
          `${env.CLIENT_URL}/oauth_callback?oauth_token=${token}`
        );
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

  // Encrypt the DID using AES-256-GCM
  function encryptDid(did: string, secret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(secret, "hex"),
      iv
    );
    let encrypted = cipher.update(did, "utf8", "base64");
    encrypted += cipher.final("base64");
    const tag = cipher.getAuthTag();
    // Return iv, tag, and encrypted data, all base64-encoded and joined
    return [iv.toString("base64"), tag.toString("base64"), encrypted].join(":");
  }

  // POST /api/auth/oauth/consume
  router.post(
    "/oauth/consume",
    handler(async (req: express.Request, res: express.Response) => {
      const { oauth_token } = req.body;
      if (!oauth_token) {
        return res.status(400).json({ error: "Missing oauth_token" });
      }
      const secret = env.OAUTH_TOKEN_SECRET;
      if (!secret) {
        ctx.logger.error("OAUTH_TOKEN_SECRET is not set");
        return res.status(500).json({ error: "Server misconfiguration" });
      }
      try {
        const did = decryptDid(oauth_token, secret);
        // Optionally: check if user exists in DB
        const user = await ctx.db
          .selectFrom("user_profile")
          .selectAll()
          .where("did", "=", did)
          .executeTakeFirst();
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        req.session = { did };
        ctx.logger.info({ did }, "Session set from oauth_token");
        return res.json({ success: true });
      } catch (err) {
        ctx.logger.error({ err }, "Failed to consume oauth_token");
        return res.status(400).json({ error: "Invalid or expired token" });
      }
    })
  );

  // Decrypt the DID using AES-256-GCM
  function decryptDid(token: string, secret: string): string {
    const [ivB64, tagB64, encrypted] = token.split(":");
    if (!ivB64 || !tagB64 || !encrypted) throw new Error("Malformed token");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(secret, "hex"),
      iv
    );
    decipher.setAuthTag(tag);
    let did = decipher.update(encrypted, "base64", "utf8");
    did += decipher.final("utf8");
    return did;
  }

  // Minimal test endpoint to set a session cookie
  router.get("/test-cookie", (req, res) => {
    req.session = { did: "test-cookie" };
    res.json({ ok: true, session: req.session });
  });

  return router;
}
