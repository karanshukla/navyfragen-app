import assert from "node:assert";
import type { IncomingMessage, ServerResponse } from "node:http";
import { OAuthResolverError } from "@atproto/oauth-client-node";
import { isValidHandle } from "@atproto/syntax";
import { TID } from "@atproto/common";
import { Agent, AtpAgent } from "@atproto/api";
import express from "express";
import { getIronSession } from "iron-session";
import type { AppContext } from "#/index";
import { env } from "#/lib/env";
import * as Profile from "#/lexicon/types/app/bsky/actor/profile";

type Session = { did: string };

// Helper function for defining routes
const handler =
  (fn: express.Handler) =>
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

// Helper function to get the Atproto Agent for the active session
async function getSessionAgent(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  ctx: AppContext
) {
  const session = await getIronSession<Session>(req, res, {
    cookieName: "sid",
    password: env.COOKIE_SECRET,
    cookieOptions: {
      httpOnly: true,
      secure: false, // Simplify: disable secure for local dev
      sameSite: "lax",
      path: "/",
    },
  });
  if (!session.did) return null;
  try {
    const oauthSession = await ctx.oauthClient.restore(session.did);
    return oauthSession ? new Agent(oauthSession) : null;
  } catch (err) {
    ctx.logger.warn({ err }, "oauth restore failed");
    await session.destroy();
    return null;
  }
}

export const createRouter = (ctx: AppContext) => {
  const router = express.Router();
  // Debug endpoint for authentication
  router.get(
    "/api/debug-cookies",
    handler(async (req, res) => {
      console.log("Auth debug endpoint called");

      // Check for token in query param or Authorization header
      const token =
        (req.query.token as string) ||
        req.headers.authorization?.replace("Bearer ", "") ||
        null;

      console.log("Token received:", token);

      let authStatus = "Not authenticated";
      let userData = null;

      if (token) {
        try {
          // Decode DID from token
          const did = Buffer.from(token, "base64").toString("ascii");
          console.log("Decoded DID from token:", did);

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
          console.error("Failed to verify token:", err);
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

  // OAuth metadata
  router.get(
    "/api/client-metadata.json",
    handler((_req, res) => {
      return res.json(ctx.oauthClient.clientMetadata);
    })
  ); // OAuth callback to complete session creation
  router.get(
    "/api/oauth/callback",
    handler(async (req, res) => {
      const params = new URLSearchParams(req.originalUrl.split("?")[1]);
      console.log(
        "OAuth callback called with params:",
        Object.fromEntries(params.entries())
      );

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

  // Login handler
  router.post(
    "/api/login",
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
    "/api/logout",
    handler(async (req, res) => {
      const session = await getIronSession<Session>(req, res, {
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

  router.get(
    "/api/session",
    handler(async (req, res) => {
      // Check for token in query param or Authorization header
      const token =
        (req.query.token as string) ||
        req.headers.authorization?.replace("Bearer ", "") ||
        null;

      console.log("Session endpoint called with token:", token);

      if (!token) {
        console.log("No token provided, returning not logged in");
        return res.json({ isLoggedIn: false, profile: null, did: null });
      }

      try {
        // Decode DID from token
        const did = Buffer.from(token, "base64").toString("ascii");
        console.log("Decoded DID from token:", did);

        // Check if session exists in DB
        const dbSession = await ctx.db
          .selectFrom("auth_session")
          .selectAll()
          .where("key", "=", did)
          .executeTakeFirst();

        if (!dbSession) {
          console.log("No session found in database for DID:", did);
          return res.json({ isLoggedIn: false, profile: null, did: null });
        }

        // Try to restore the session using the OAuth client
        let agent;
        let authenticated = false;
        try {
          const oauthSession = await ctx.oauthClient.restore(did);
          // Remove all session expiration/refresh logic, just check if oauthSession exists
          if (oauthSession) {
            agent = new Agent(oauthSession);
            // Test if the session is valid by checking assertDid
            const agentDid = agent.assertDid;
            authenticated = true;
            console.log("Authenticated session for DID:", agentDid);
          } else {
            console.log("No OAuth session found for DID:", did);
          }
        } catch (err) {
          console.warn(
            "Could not restore authenticated session, falling back to public profile",
            err
          );
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
              Profile.isRecord(profileResponse.data.value)
            ) {
              return res.json({
                isLoggedIn: true,
                profile: profileResponse.data.value,
                did,
              });
            }
          } catch (profileErr) {
            console.warn(
              "Authenticated profile fetch failed, falling back to public",
              profileErr
            );
          }
        }

        // If not authenticated, or profile fetch failed, fetch public profile
        try {
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
          console.error("Error fetching public profile:", profileErr);
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

  // Fetch messages for a user (by recipient DID)
  router.get(
    "/api/messages/:recipient",
    handler(async (req, res) => {
      const recipient = req.params.recipient;
      if (!recipient)
        return res.status(400).json({ error: "Recipient DID required" });
      // Check if recipient exists in auth_session table
      const userExists = await ctx.db
        .selectFrom("auth_session")
        .select("key")
        .where("key", "=", recipient)
        .executeTakeFirst();
      if (!userExists) {
        return res.status(404).json({ error: "User not found" });
      }
      const messages = await ctx.db
        .selectFrom("message")
        .selectAll()
        .where("recipient", "=", recipient)
        .orderBy("createdAt desc")
        .execute();
      return res.json({ messages });
    })
  );

  // Add example messages for testing
  router.post(
    "/api/messages/example",
    handler(async (req, res) => {
      const { recipient } = req.body;
      ctx.logger.info({ recipient }, "POST /api/messages/example called");
      if (!recipient) {
        ctx.logger.warn("Recipient DID required for example messages");
        return res.status(400).json({ error: "Recipient DID required" });
      }
      // Insert a few example messages
      const now = new Date();
      const messages = [
        {
          tid: `example-1-${Date.now()}`,
          message: "Do you like cats?",
          createdAt: now.toISOString(),
          recipient,
        },
        {
          tid: `example-2-${Date.now()}`,
          message: "Do you like dogs?",
          createdAt: new Date(now.getTime() + 1000).toISOString(),
          recipient,
        },
      ];
      for (const msg of messages) {
        ctx.logger.debug({ msg }, "Inserting example message");
        await ctx.db
          .insertInto("message")
          .values(msg)
          .onConflict((oc) => oc.column("tid").doNothing())
          .execute();
      }
      // Return all messages for this recipient
      const allMessages = await ctx.db
        .selectFrom("message")
        .selectAll()
        .where("recipient", "=", recipient)
        .orderBy("createdAt desc")
        .execute();
      ctx.logger.info(
        { count: allMessages.length },
        "Returning all messages for recipient"
      );
      return res.json({ messages: allMessages });
    })
  );

  // Delete a message by tid
  router.delete(
    "/api/messages/:tid",
    handler(async (req, res) => {
      const tid = req.params.tid;
      if (!tid) return res.status(400).json({ error: "tid required" });
      await ctx.db.deleteFrom("message").where("tid", "=", tid).execute();
      return res.json({ success: true });
    })
  );

  // Respond to a message and post to Bluesky
  router.post(
    "/api/messages/respond",
    handler(async (req, res) => {
      const { tid, recipient, original, response } = req.body;
      if (!tid || !recipient || !response) {
        ctx.logger.warn(
          { tid, recipient, response },
          "Missing required fields in respond endpoint"
        );
        return res.status(400).json({ error: "Missing required fields" });
      }
      // Get the session from the token (if present)
      let token =
        req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (!token && req.cookies && req.cookies.auth_token) {
        token = req.cookies.auth_token;
      }
      let did = null;
      let agent = null;
      let rawToken = token;
      let sessionExists = false;
      if (Array.isArray(rawToken)) rawToken = rawToken[0];
      if (typeof rawToken === "object" && rawToken !== null)
        rawToken = String(rawToken);
      if (rawToken && typeof rawToken === "string") {
        try {
          did = Buffer.from(rawToken, "base64").toString("ascii");
          // Check if session exists in DB before attempting restore
          const dbSession = await ctx.db
            .selectFrom("auth_session")
            .selectAll()
            .where("key", "=", did)
            .executeTakeFirst();
          if (!dbSession) {
            sessionExists = false;
          } else {
            sessionExists = true;
            let oauthSession;
            try {
              oauthSession = await ctx.oauthClient.restore(did);
              if (oauthSession) {
                const { Agent } = require("@atproto/api");
                agent = new Agent(oauthSession);
                try {
                  await agent.app.bsky.actor.getProfile({ actor: did });
                } catch (err) {
                  agent = null;
                }
              }
            } catch (restoreErr) {
              // ignore
            }
          }
        } catch (err) {
          // ignore
        }
      }
      // Fallback: try to get session from request body (for dev/testing)
      if (!agent && req.body && req.body.token) {
        try {
          const did2 = Buffer.from(req.body.token, "base64").toString("ascii");
          const dbSession2 = await ctx.db
            .selectFrom("auth_session")
            .selectAll()
            .where("key", "=", did2)
            .executeTakeFirst();
          if (dbSession2) {
            const oauthSession = await ctx.oauthClient.restore(did2);
            if (oauthSession) {
              const { Agent } = require("@atproto/api");
              agent = new Agent(oauthSession);
            }
          }
        } catch (err) {
          // ignore
        }
      }
      if (!agent) {
        let errorMsg = "Not authenticated";
        if (did && sessionExists === false) {
          errorMsg =
            "Session for this user was deleted or expired. Please log in again.";
        }
        return res.status(401).json({ error: errorMsg });
      }
      // Post the response as text, including the original message and hashtag
      try {
        const postText = `Q: ${original}\n\nA: ${response}\n\n#Navyfragen`;
        const postRes = await agent.post({
          text: postText,
        });
        // Convert at:// URI to a proper Bluesky web link
        let webUrl = null;
        let profileName = null;
        const match = postRes.uri.match(
          /^at:\/\/(.+?)\/app\.bsky\.feed\.post\/(.+)$/
        );
        if (match) {
          const did = match[1];
          const rkey = match[2];
          // Try to resolve the handle/profile name for the DID
          try {
            const profileRes = await agent.app.bsky.actor.getProfile({
              actor: did,
            });
            if (profileRes?.data?.handle) {
              profileName = profileRes.data.handle;
              webUrl = `https://bsky.app/profile/${profileName}/post/${encodeURIComponent(rkey)}`;
            } else {
              webUrl = `https://bsky.app/profile/${did}/post/${encodeURIComponent(rkey)}`;
            }
          } catch (e) {
            webUrl = `https://bsky.app/profile/${did}/post/${encodeURIComponent(rkey)}`;
          }
        }
        return res.json({ success: true, uri: postRes.uri, link: webUrl });
      } catch (err) {
        return res.status(500).json({ error: "Failed to post to Bluesky" });
      }
    })
  );

  // Public profile for a DID
  router.get(
    "/api/public-profile/:did",
    handler(async (req, res) => {
      const did = req.params.did;
      if (!did) return res.status(400).json({ error: "DID required" });
      try {
        const agent = new AtpAgent({ service: "https://api.bsky.app" });
        const profileResponse = await agent.getProfile({ actor: did });
        if (profileResponse.success) {
          return res.json({ profile: profileResponse.data });
        } else {
          return res.status(404).json({ error: "Profile not found" });
        }
      } catch (err) {
        return res.status(404).json({ error: "Profile not found" });
      }
    })
  );

  // Allow anyone to send an anonymous message to a DID
  router.post(
    "/api/messages/send",
    handler(async (req, res) => {
      const { recipient, message } = req.body;
      if (!recipient || !message) {
        return res
          .status(400)
          .json({ error: "Recipient and message required" });
      }
      const tid = `anon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const msg = {
        tid,
        message,
        createdAt: new Date().toISOString(),
        recipient,
      };
      await ctx.db
        .insertInto("message")
        .values(msg)
        .onConflict((oc) => oc.column("tid").doNothing())
        .execute();
      return res.json({ success: true });
    })
  );

  // Check if a DID exists in the app's database
  router.get(
    "/api/user-exists/:did",
    handler(async (req, res) => {
      const did = req.params.did;
      if (!did) return res.status(400).json({ error: "DID required" });
      const userExists = await ctx.db
        .selectFrom("auth_session")
        .select("key")
        .where("key", "=", did)
        .executeTakeFirst();
      return res.json({ exists: !!userExists });
    })
  );

  // Endpoint for a user to delete their data from the DB
  router.delete(
    "/api/delete-account",
    handler(async (req, res) => {
      // Get the token from Authorization header, query, or cookie
      let token =
        req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (!token && req.cookies && req.cookies.auth_token) {
        token = req.cookies.auth_token;
      }
      let did = null;
      if (Array.isArray(token)) token = token[0];
      if (typeof token === "object" && token !== null) token = String(token);
      if (token && typeof token === "string") {
        try {
          did = Buffer.from(token, "base64").toString("ascii");
        } catch (err) {
          return res.status(400).json({ error: "Invalid token" });
        }
      }
      if (!did) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      // Delete all messages and session for this DID
      await ctx.db.deleteFrom("message").where("recipient", "=", did).execute();
      await ctx.db.deleteFrom("auth_session").where("key", "=", did).execute();
      return res.json({ success: true });
    })
  );

  return router;
};
