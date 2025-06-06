import express from "express";
import { body } from "express-validator";
import type { AppContext } from "../index";
import { generateQuestionImage } from "../lib/image-generator";
import { RichText } from "@atproto/api";
import { ids } from "../lexicon/lexicons"; // Added import for lexicon NSIDs
import { type Record as MessageSchemaRecord } from "../lexicon/types/app/navyfragen/message"; // Added import for base message record type
import { initializeAgentFromSession } from "#/auth/session-agent";
import { UserSettings } from "#/database/db";

// MessageSchemaRecord already defines: message, createdAt, recipient.

export function messageRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  const router = express.Router();

  // Add example messages for the user
  router.post(
    "/messages/example",
    body("recipient")
      .isString()
      .notEmpty()
      .withMessage("Recipient DID required"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      const recipient = req.session?.did;
      if (!recipient) {
        return res.status(403).json({ error: "Recipient DID required" });
      }

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
    body("tid").isString().notEmpty().withMessage("Message TID required"),
    body("recipient")
      .isString()
      .notEmpty()
      .withMessage("Recipient DID required"),
    body("original")
      .isString()
      .notEmpty()
      .withMessage("Original message required"),
    body("response")
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage("Response must be 1-500 chars"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      const { tid, recipient, original, response } = req.body;
      if (!tid || !recipient || !response) {
        ctx.logger.warn(
          { tid, recipient, response },
          "Missing required fields in respond endpoint"
        );
        return res.status(400).json({ error: "Missing required fields" });
      }
      const did = req.session?.did;
      if (!did) {
        ctx.logger.warn("No authenticated user session found");
        return res.status(403).json({ error: "Not authenticated" });
      }
      const agent = await initializeAgentFromSession(req, ctx);
      if (!agent) {
        ctx.logger.warn({ did }, "No agent could be initialized from session");
        return res.json({ isLoggedIn: false, profile: null, did: null });
      }
      try {
        const accountDid = did;
        const handle = await ctx.resolver.resolveDidToHandle(accountDid);

        const rt = new RichText({ text: response });
        await rt.detectFacets(agent);

        const postRecord: any = {
          text: rt.text, // The user's response is the main text
          facets: rt.facets || [],
          createdAt: new Date().toISOString(),
        };

        const { imageBlob, imageAltText } = await generateQuestionImage(
          original,
          ctx.logger,
          handle
        );

        if (!imageBlob) {
          ctx.logger.error("Image generation failed, no imageBlob returned");
          return res.status(500).json({ error: "Image generation failed" });
        }

        if (imageBlob && agent) {
          try {
            const uploadedImage = await agent.uploadBlob(imageBlob, {
              encoding: "image/png", // Assuming PNG, adjust if API returns something different
            });
            postRecord.embed = {
              $type: "app.bsky.embed.images",
              images: [
                {
                  image: uploadedImage.data.blob,
                  alt: imageAltText || "Image of the anonymous question",
                },
              ],
            };
          } catch (uploadErr) {
            ctx.logger.error(uploadErr, "Failed to upload image to Bluesky");
          }
        }

        const postRes = await agent.post(postRecord);
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
        ctx.logger.error(
          err,
          "Error in /messages/respond endpoint while trying to post to Bluesky"
        );
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
      // Check if recipient exists in user_profile table
      const userProfileExists = await ctx.db
        .selectFrom("user_profile")
        .select("did")
        .where("did", "=", recipient)
        .executeTakeFirst();

      if (!userProfileExists) {
        return res
          .status(404)
          .json({ error: "Recipient not found (user profile does not exist)" });
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

  // Fetch messages for a user (requires auth)
  router.get(
    "/messages/:recipient",
    handler(async (req: express.Request, res: express.Response) => {
      const recipient = req.session?.did;
      if (!recipient) {
        return res.status(403).json({ error: "Not authenticated" });
      }
      // Check if recipient exists in user_profile table
      const userProfileExists = await ctx.db
        .selectFrom("user_profile")
        .select("did")
        .where("did", "=", recipient)
        .executeTakeFirst();

      if (!userProfileExists) {
        return res
          .status(404)
          .json({ error: "User not found (user profile does not exist)" });
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
      const userSessionDid = req.session?.did;
      if (!userSessionDid) {
        return res.status(403).json({ error: "Not authenticated" });
      }
      const agent = await initializeAgentFromSession(req, ctx);
      if (!agent) {
        ctx.logger.warn(
          { userSessionDid },
          "No agent could be initialized from session"
        );
        return res.json({ isLoggedIn: false, profile: null, did: null });
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
      if (message.recipient !== userSessionDid) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this message" });
      }
      // Delete the message
      await ctx.db.deleteFrom("message").where("tid", "=", tid).execute();

      // Delete from the PDS
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: userSessionDid,
          collection: ids.AppNavyfragenMessage,
          rkey: tid, // Use the TID as the rkey
        });
      } catch (err) {
        ctx.logger.error(
          { error: err, tid },
          "Failed to delete message from PDS"
        );
        return res.status(500).json({
          error:
            "Failed to delete message from PDS, but data deleted in the DB",
        });
      }

      return res.json({ success: true });
    })
  );

  // Endpoint for a user to delete their data from the DB, need to also delete from the PDS
  router.delete(
    "/delete-account",
    handler(async (req: express.Request, res: express.Response) => {
      const userSessionDid = req.session?.did;
      if (!userSessionDid) {
        return res.status(403).json({ error: "Not authenticated" });
      }
      const agent = await initializeAgentFromSession(req, ctx);

      if (!agent || !userSessionDid) {
        return res.status(401).json({
          error:
            "Authentication failed - could not initialize agent or retrieve user DID",
        });
      }

      // Delete all messages, session, and user profile for this DID
      await ctx.db
        .deleteFrom("message")
        .where("recipient", "=", userSessionDid)
        .execute();
      await ctx.db
        .deleteFrom("auth_session")
        .where("key", "=", userSessionDid)
        .execute();
      await ctx.db
        .deleteFrom("user_profile")
        .where("did", "=", userSessionDid)
        .execute();

      return res.json({ success: true });
    })
  );

  // Endpoint to push data to the user's bsky repo, need to implement in the AppShell in the future
  router.post(
    "/messages/sync",
    handler(async (req: express.Request, res: express.Response) => {
      const userSessionDid = req.session?.did;

      if (!userSessionDid) {
        return res.status(403).json({ error: "Not authenticated" });
      }

      //stopgap for now
      const userSettings = await ctx.db
        .selectFrom("user_settings")
        .selectAll()
        .where("did", "=", userSessionDid)
        .executeTakeFirst();
      if (!userSettings || !userSettings?.pdsSyncEnabled) {
        return res.status(200);
      }

      // Initialize the agent for the authenticated user session
      const agent = await initializeAgentFromSession(req, ctx);

      if (!agent) {
        return res.status(401).json({
          error: "Authentication failed - could not initialize agent",
        });
      }

      try {
        // Fetch messages from the local database for the user
        const localMessages = await ctx.db
          .selectFrom("message")
          .selectAll() // Selects tid, message, createdAt, recipient
          .where("recipient", "=", userSessionDid)
          .execute();

        if (localMessages.length === 0) {
          ctx.logger.info(
            { did: userSessionDid },
            "No local messages to sync to PDS."
          );
          return res.json({
            success: true,
            message: "No local messages to sync.",
            syncedCount: 0,
            errorCount: 0,
            errors: [],
          });
        }

        let syncedCount = 0;
        let errorCount = 0;
        const syncErrors: { tid: string; error: string }[] = [];

        ctx.logger.info(
          { did: userSessionDid, count: localMessages.length },
          `Starting PDS sync for ${localMessages.length} messages.`
        );

        for (const dbMessage of localMessages) {
          const rkey = dbMessage.tid; // Use tid from DB as the rkey
          const recordToCreate: MessageSchemaRecord = {
            $type: ids.AppNavyfragenMessage,
            createdAt: dbMessage.createdAt,
            message: dbMessage.message,
            recipient: dbMessage.recipient, // This should be userSessionDid
          };

          try {
            const createResponse = await agent.com.atproto.repo.createRecord({
              repo: agent.assertDid, // The authenticated user's repo
              collection: ids.AppNavyfragenMessage,
              rkey: rkey,
              record: recordToCreate,
              // To prevent overwriting if a record with the same rkey somehow exists,
              // we can use validate: false, or ensure rkeys are truly unique if created by this system.
              // For now, createRecord will fail if the rkey exists, which is reasonable for a sync.
            });
            syncedCount++;
            ctx.logger.info(
              { did: userSessionDid, rkey, uri: createResponse.data.uri },
              "Successfully synced message to PDS"
            );
          } catch (err: any) {
            errorCount++;
            const errorMessage =
              err.message || "Unknown error during PDS record creation";
            syncErrors.push({ tid: rkey, error: errorMessage });
          }
        }

        ctx.logger.info(
          { did: userSessionDid, syncedCount, errorCount },
          "PDS sync completed."
        );
        return res.json({
          success: true,
          syncedCount,
          errorCount,
          errors: syncErrors,
        });
      } catch (err: any) {
        ctx.logger.error(
          { did: userSessionDid, error: err },
          "Error during /messages/sync process"
        );
        return res.status(500).json({
          error: "Failed to sync messages to PDS",
          details: err.message,
        });
      }
    })
  );

  /*
  router.get(
    "/messages/debug/pds-records",
    handler(async (req: express.Request, res: express.Response) => {
      let rawTokenValue =
        req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (!rawTokenValue && req.cookies && req.cookies.auth_token) {
        rawTokenValue = req.cookies.auth_token;
      }
      if (Array.isArray(rawTokenValue)) rawTokenValue = rawTokenValue[0];
      if (typeof rawTokenValue === "object" && rawTokenValue !== null)
        rawTokenValue = String(rawTokenValue);

      let agent: AtpAgent | null = null;
      let userSessionDid: string | null = null;
      let sessionExistsInDb = false;

      if (rawTokenValue && typeof rawTokenValue === "string") {
        const agentInitResult = await initializeAuthenticatedAgent(
          rawTokenValue,
          ctx
        );
        if (agentInitResult) {
          agent = agentInitResult.agent;
          userSessionDid = agentInitResult.userSessionDid;
          sessionExistsInDb = agentInitResult.sessionExists;
        } else {
          let decodedDidForError: string | null = null;
          try {
            decodedDidForError = Buffer.from(rawTokenValue, "base64").toString(
              "ascii"
            );
            const dbSession = await ctx.db
              .selectFrom("auth_session")
              .selectAll()
              .where("key", "=", decodedDidForError)
              .executeTakeFirst();
            sessionExistsInDb = !!dbSession;
          } catch (e) {
            // ignore, sessionExistsInDb will remain false
          }
        }
      }

      if (!agent || !userSessionDid) {
        let errorMsg = "Not authenticated or agent initialization failed.";
        if (rawTokenValue && !sessionExistsInDb) {
          errorMsg =
            "Session for this user was deleted, expired, or invalid. Please log in again.";
        }
        return res.status(401).json({ error: errorMsg });
      }

      try {
        ctx.logger.info(
          { did: userSessionDid },
          "Attempting to fetch all message records from PDS for debug."
        );

        const listRecordsResponse = await agent.com.atproto.repo.listRecords({
          repo: agent.assertDid, // The authenticated user's repo
          collection: ids.AppNavyfragenMessage,
          // limit: 100, // Optionally add a limit
        });

        ctx.logger.info(
          {
            did: userSessionDid,
            count: listRecordsResponse.data.records.length,
          },
          "Successfully fetched message records from PDS."
        );

        return res.json({
          success: true,
          did: userSessionDid,
          records: listRecordsResponse.data.records,
          cursor: listRecordsResponse.data.cursor,
        });
      } catch (err: any) {
        ctx.logger.error(
          { did: userSessionDid, error: err },
          "Error during /messages/debug/pds-records process"
        );
        return res.status(500).json({
          error: "Failed to fetch records from PDS",
          details: err.message,
        });
      }
    })
  );
  */

  return router;
}
