import assert from "node:assert";
import type { IncomingMessage, ServerResponse } from "node:http";
import { OAuthResolverError } from "@atproto/oauth-client-node";
import { isValidHandle } from "@atproto/syntax";
import { TID } from "@atproto/common";
import { Agent } from "@atproto/api";
import express from "express";
import { getIronSession } from "iron-session";
import type { AppContext } from "#/index";
import { env } from "#/lib/env";
import * as Profile from "#/lexicon/types/app/bsky/actor/profile";
import cookieParser from "cookie-parser";

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
        const { session } = await ctx.oauthClient.callback(params);
        console.log("Got OAuth session:", session);

        // Save session directly to DB without cookies
        await ctx.db
          .insertInto("auth_session")
          .values({
            key: session.did,
            session: JSON.stringify(session),
          })
          .onConflict((oc) =>
            oc.column("key").doUpdateSet({ session: JSON.stringify(session) })
          )
          .execute();

        console.log("Saved session to DB with DID:", session.did);

        // Generate a simple token by encoding the DID
        const token = Buffer.from(session.did).toString("base64");

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
          if (oauthSession) {
            agent = new Agent(oauthSession);
            // Test if the session is valid by checking assertDid
            const agentDid = agent.assertDid;
            authenticated = true;
            console.log("Authenticated session for DID:", agentDid);
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
          const { AppBskyActor } = require("@atproto/api");
          const profileResponse = await AppBskyActor.getProfile({ actor: did });
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

  return router;
};
