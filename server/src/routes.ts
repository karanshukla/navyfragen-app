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
        // The callback returns { session, ... }. The session is already stored by the sessionStore.
        const callbackResult = await ctx.oauthClient.callback(params);
        // Do NOT manually save callbackResult.session to the DB!
        // The session is already stored by the sessionStore (see auth/storage.ts).
        // Only generate the token for the client.
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

  // API endpoint for homepage data
  router.get(
    "/api/home-data",
    handler(async (req, res) => {
      const agent = await getSessionAgent(req, res, ctx);
      const statuses = await ctx.db
        .selectFrom("status")
        .selectAll()
        .orderBy("indexedAt", "desc")
        .limit(10)
        .execute();
      const myStatus = agent
        ? await ctx.db
            .selectFrom("status")
            .selectAll()
            .where("authorDid", "=", agent.assertDid)
            .orderBy("indexedAt", "desc")
            .executeTakeFirst()
        : undefined;
      const didHandleMap = await ctx.resolver.resolveDidsToHandles(
        statuses.map((s) => s.authorDid)
      );
      let userProfile = null;
      if (agent) {
        const profileResponse = await agent.com.atproto.repo
          .getRecord({
            repo: agent.assertDid,
            collection: "app.bsky.actor.profile",
            rkey: "self",
          })
          .catch(() => undefined);
        if (
          profileResponse?.data &&
          Profile.isRecord(profileResponse.data.value) &&
          Profile.validateRecord(profileResponse.data.value).success
        ) {
          userProfile = profileResponse.data.value;
        }
      }
      return res.json({
        statuses,
        didHandleMap,
        profile: userProfile,
        myStatus,
        isLoggedIn: !!agent,
        currentUserDid: agent?.assertDid || null,
      });
    })
  );

  /*
  router.post(
    "/api/status",
    handler(async (req, res) => {
      const agent = await getSessionAgent(req, res, ctx);
      if (!agent) {
        return res.status(401).json({ error: "Session required" });
      }
      const rkey = TID.nextStr();
      const record = {
        $type: "app.navyfragen.status",
        status: req.body?.status,
        createdAt: new Date().toISOString(),
      };
      if (!Status.validateRecord(record).success) {
        return res.status(400).json({ error: "Invalid status" });
      }
      let recordUri;
      try {
        const putRecordRes = await agent.com.atproto.repo.putRecord({
          repo: agent.assertDid,
          collection: "app.navyfragen.status",
          rkey,
          record,
          validate: false,
        });
        recordUri = putRecordRes.data.uri;
      } catch (err) {
        ctx.logger.warn({ err }, "failed to write record");
        return res.status(500).json({ error: "Failed to write record" });
      }
      try {
        await ctx.db
          .insertInto("status")
          .values({
            uri: recordUri,
            authorDid: agent.assertDid,
            status: record.status,
            createdAt: record.createdAt,
            indexedAt: new Date().toISOString(),
          })
          .execute();
        try {
          await agent.post({
            text: `My current status: ${record.status}`,
            createdAt: record.createdAt,
          });
          ctx.logger.info("Created Bluesky post from Navyfragen with status");
        } catch (postErr) {
          ctx.logger.warn(
            { err: postErr },
            "Failed to create Bluesky post, but status was set"
          );
        }
      } catch (err) {
        ctx.logger.warn(
          { err },
          "failed to update computed view; ignoring as it should be caught by the firehose"
        );
      }
      return res
        .status(201)
        .json({ message: "Status updated", status: record, uri: recordUri });
    })
  );  */ // API endpoint to get current session/user info
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
      if (!recipient) {
        return res.status(400).json({ error: "Recipient DID required" });
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
      ctx.logger.info(
        {
          token,
          headers: req.headers,
          cookies: req.cookies,
          query: req.query,
          body: req.body,
        },
        "Token extraction in respond endpoint"
      );
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
          ctx.logger.info(
            { rawToken, did },
            "Decoded DID from token in respond endpoint"
          );
          // Check if session exists in DB before attempting restore
          const dbSession = await ctx.db
            .selectFrom("auth_session")
            .selectAll()
            .where("key", "=", did)
            .executeTakeFirst();
          if (!dbSession) {
            ctx.logger.warn(
              { did },
              "No session found in database for DID in respond endpoint"
            );
            sessionExists = false;
          } else {
            sessionExists = true;
            let oauthSession;
            try {
              oauthSession = await ctx.oauthClient.restore(did);
              if (oauthSession) {
                const { Agent } = require("@atproto/api");
                agent = new Agent(oauthSession);
                ctx.logger.info(
                  { did, dbSession },
                  "Session row found, attempting authenticated call"
                );
                try {
                  await agent.app.bsky.actor.getProfile({ actor: did });
                } catch (err) {
                  ctx.logger.warn(
                    { did, err },
                    "Session appears invalid or expired, cannot refresh (no refreshSession method available)"
                  );
                  agent = null;
                }
              } else {
                ctx.logger.warn(
                  { did },
                  "No OAuth session found for DID in respond endpoint"
                );
              }
            } catch (restoreErr) {
              ctx.logger.error(
                { did, dbSession, restoreErr },
                "Exception thrown by oauthClient.restore in respond endpoint"
              );
            }
          }
        } catch (err) {
          ctx.logger.error(
            { err, rawToken },
            "Failed to decode/restore session from token in respond endpoint"
          );
        }
      }
      // Fallback: try to get session from request body (for dev/testing)
      if (!agent && req.body && req.body.token) {
        try {
          const did2 = Buffer.from(req.body.token, "base64").toString("ascii");
          ctx.logger.info(
            { did2 },
            "Decoded fallback DID from body token in respond endpoint"
          );
          const dbSession2 = await ctx.db
            .selectFrom("auth_session")
            .selectAll()
            .where("key", "=", did2)
            .executeTakeFirst();
          if (!dbSession2) {
            ctx.logger.warn(
              { did2 },
              "No fallback session found in database for DID in respond endpoint"
            );
            sessionExists = false;
          } else {
            sessionExists = true;
            const oauthSession = await ctx.oauthClient.restore(did2);
            if (oauthSession) {
              const { Agent } = require("@atproto/api");
              agent = new Agent(oauthSession);
              ctx.logger.info(
                { did2 },
                "Restored fallback OAuth session and created Agent in respond endpoint"
              );
            } else {
              ctx.logger.warn(
                { did2 },
                "No fallback OAuth session found for DID in respond endpoint"
              );
            }
          }
        } catch (err) {
          ctx.logger.error(
            { err },
            "Failed to decode/restore fallback session from body token in respond endpoint"
          );
        }
      }
      if (!agent) {
        let errorMsg = "Not authenticated";
        if (did && sessionExists === false) {
          errorMsg =
            "Session for this user was deleted or expired. Please log in again.";
        }
        // Extra debug: dump session and oauthSession if available
        let debugSession = null;
        let debugOauthSession = null;
        try {
          // Try to fetch and parse the session row for debug
          const debugRow = did
            ? await ctx.db
                .selectFrom("auth_session")
                .selectAll()
                .where("key", "=", did)
                .executeTakeFirst()
            : null;
          debugSession = debugRow ? debugRow.session : null;
          debugOauthSession = debugSession ? JSON.parse(debugSession) : null;
        } catch (e) {
          debugSession = `Error: ${e}`;
        }
        ctx.logger.error(
          {
            tid,
            recipient,
            original,
            response,
            token,
            did,
            sessionExists,
            debugSession,
            debugOauthSession,
          },
          "DEBUG: Not authenticated in respond endpoint - session and oauthSession dump"
        );
        return res.status(401).json({ error: errorMsg });
      }
      // Post the response to Bluesky
      try {
        ctx.logger.info(
          { tid, recipient, original, response, did },
          "Posting response to Bluesky in respond endpoint"
        );
        const postRes = await agent.post({
          text: `Reply to anonymous message: "${original}"
\n${response}`,
        });
        ctx.logger.info(
          { uri: postRes.uri },
          "Successfully posted response to Bluesky in respond endpoint"
        );
        // Convert at:// URI to a proper Bluesky web link
        // Example: at://did:plc:jsvtouhag7lgnq75f2ze5raf/app.bsky.feed.post/3lq46b6qi572p
        // becomes https://bsky.app/profile/did:plc:jsvtouhag7lgnq75f2ze5raf/post/3lq46b6qi572p
        let webUrl = null;
        const match = postRes.uri.match(
          /^at:\/\/(.+?)\/app\.bsky\.feed\.post\/(.+)$/
        );
        if (match) {
          const did = match[1];
          const rkey = match[2];
          // DO NOT encode the colon in the DID, only encode the rkey
          webUrl = `https://bsky.app/profile/${did}/post/${encodeURIComponent(rkey)}`;
        }
        return res.json({ success: true, uri: postRes.uri, link: webUrl });
      } catch (err) {
        ctx.logger.error(
          { err, tid, recipient, original, response, did },
          "Failed to post response to Bluesky in respond endpoint"
        );
        return res.status(500).json({ error: "Failed to post to Bluesky" });
      }
    })
  );

  return router;
};
