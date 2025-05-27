import express from "express";
import { body, validationResult } from "express-validator";
import { TID } from "@atproto/common";
import type { AppContext } from "../index";

export function messageRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  const router = express.Router();

  // Add example messages
  router.post(
    "/messages/example",
    body("recipient")
      .isString()
      .notEmpty()
      .withMessage("Recipient DID required"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      const { recipient } = req.body;
      if (!recipient) {
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
      return res.json({ messages: allMessages });
    })
  );

  // Respond to a message and post to Bluesky
  router.post(
    "/messages/respond",
    handler(async (req: express.Request, res: express.Response) => {
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
        const postText = `Q: ${original}\n\nA: ${response}\n\n (posted via navyfragen.app)`;
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

  // Send anonymous message
  router.post(
    "/messages/send",
    body("recipient")
      .isString()
      .notEmpty()
      .withMessage("Recipient DID required"),
    body("message")
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage("Message must be 1-500 chars"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      const { recipient, message } = req.body;
      if (!recipient || !message) {
        return res
          .status(400)
          .json({ error: "Recipient and message required" });
      }
      // Check if recipient exists in auth_session table
      const userExists = await ctx.db
        .selectFrom("auth_session")
        .select("key")
        .where("key", "=", recipient)
        .executeTakeFirst();
      if (!userExists) {
        return res.status(404).json({ error: "Recipient not found" });
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

  // Fetch messages for a user
  router.get(
    "/messages/:recipient",
    handler(async (req: express.Request, res: express.Response) => {
      const recipient = req.params.recipient;
      if (!recipient) {
        return res.status(400).json({ error: "Recipient DID required" });
      }
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

  // Delete a message
  router.delete(
    "/messages/:tid",
    handler(async (req: express.Request, res: express.Response) => {
      const { tid } = req.params;
      if (!tid) {
        return res.status(400).json({ error: "Message TID required" });
      }
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
      // Find the message and check ownership
      const message = await ctx.db
        .selectFrom("message")
        .selectAll()
        .where("tid", "=", tid)
        .executeTakeFirst();
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      if (message.recipient !== did) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this message" });
      }
      // Delete the message
      await ctx.db.deleteFrom("message").where("tid", "=", tid).execute();
      return res.json({ success: true });
    })
  );

  // Endpoint for a user to delete their data from the DB
  router.delete(
    "/delete-account",
    handler(async (req: express.Request, res: express.Response) => {
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
}
