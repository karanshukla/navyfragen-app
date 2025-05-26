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

  // OAuth metadata
  router.get(
    "/api/client-metadata.json",
    handler((_req, res) => {
      return res.json(ctx.oauthClient.clientMetadata);
    })
  );

  // OAuth callback to complete session creation
  router.get(
    "/api/oauth/callback",
    handler(async (req, res) => {
      const params = new URLSearchParams(req.originalUrl.split("?")[1]);
      try {
        const { session } = await ctx.oauthClient.callback(params);
        const clientSession = await getIronSession<Session>(req, res, {
          cookieName: "sid",
          password: env.COOKIE_SECRET,
        });
        assert(!clientSession.did, "session already exists");
        clientSession.did = session.did;
        await clientSession.save();
      } catch (err) {
        ctx.logger.error({ err }, "oauth callback failed");
        return res.status(500).json({ error: "OAuth callback failed" });
      }
      return res
        .status(200)
        .json({ message: "OAuth successful, session created" });
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

  // "Set status" handler
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
  );

  // API endpoint to get current session/user info
  router.get(
    "/api/session",
    handler(async (req, res) => {
      const agent = await getSessionAgent(req, res, ctx);
      if (!agent) {
        return res.json({ isLoggedIn: false, profile: null, did: null });
      }
      let userProfileData = null;
      try {
        const profileResponse = await agent.com.atproto.repo.getRecord({
          repo: agent.assertDid,
          collection: "app.bsky.actor.profile",
          rkey: "self",
        });
        if (
          profileResponse?.data &&
          Profile.isRecord(profileResponse.data.value)
        ) {
          userProfileData = profileResponse.data.value;
        }
      } catch (err) {
        ctx.logger.warn(
          { err, did: agent.assertDid },
          "Failed to fetch profile for session"
        );
      }
      return res.json({
        isLoggedIn: true,
        profile: userProfileData,
        did: agent.assertDid,
      });
    })
  );

  return router;
};
