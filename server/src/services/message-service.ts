import { type Database } from "../database/db";
import { Logger } from "pino";
import { RichText, Agent } from "@atproto/api";
import { ids } from "../lexicon/lexicons";
import { type Record as MessageSchemaRecord } from "../lexicon/types/app/navyfragen/message";
import { imageGenerator } from "../lib/image-generator";

export interface ProfileResolver {
  resolveDidToHandle(did: string): Promise<string | undefined>;
}

export interface Message {
  tid: string;
  message: string;
  createdAt: string;
  recipient: string;
}

export class MessageService {
  constructor(
    private db: Database,
    private resolver: ProfileResolver,
    private logger: Logger
  ) {}

  /**
   * Get all messages for a user
   * @param recipient The recipient's DID
   * @returns Array of messages
   */
  async getMessages(recipient: string): Promise<Message[]> {
    try {
      // Check if recipient exists in user_profile table
      const userProfileExists = await this.db
        .selectFrom("user_profile")
        .select("did")
        .where("did", "=", recipient)
        .executeTakeFirst();

      if (!userProfileExists) {
        throw new Error("User profile does not exist");
      }

      const messages = await this.db
        .selectFrom("message")
        .selectAll()
        .where("recipient", "=", recipient)
        .orderBy("createdAt desc")
        .execute();

      return messages;
    } catch (err) {
      this.logger.error({ err, recipient }, "Failed to fetch messages");
      throw new Error("Failed to fetch messages");
    }
  }

  /**
   * Add example messages for a user
   * @param recipient The recipient's DID
   * @returns Array of all messages for the user including the examples
   */
  async addExampleMessages(recipient: string): Promise<Message[]> {
    try {
      const now = new Date();
      const exampleTexts = [
        "Do you like cats?",
        "Do you like dogs?",
        "What's your favorite movie?",
        "If you could travel anywhere, where would you go?",
        "What's something most people don't know about you?",
        "What's the best piece of advice you've ever received?",
        "What are you currently obsessed with?",
        "What's your hot take on something totally mundane?",
      ];
      const messages = exampleTexts.map((message, i) => ({
        tid: `example-${i + 1}-${Date.now()}`,
        message,
        createdAt: new Date(now.getTime() + i * 1000).toISOString(),
        recipient,
      }));

      for (const msg of messages) {
        await this.db
          .insertInto("message")
          .values(msg)
          .onConflict((oc) => oc.column("tid").doNothing())
          .execute();
      }

      return await this.getMessages(recipient);
    } catch (err) {
      this.logger.error({ err, recipient }, "Failed to add example messages");
      throw new Error("Failed to add example messages");
    }
  }

  /**
   * Send an anonymous message to a user
   * @param recipient The recipient's DID
   * @param message The message content
   * @returns Success status
   */
  async sendMessage(
    recipient: string,
    message: string
  ): Promise<{ success: boolean }> {
    try {
      // Check if recipient exists in user_profile table
      const userProfileExists = await this.db
        .selectFrom("user_profile")
        .select("did")
        .where("did", "=", recipient)
        .executeTakeFirst();

      if (!userProfileExists) {
        throw new Error("Recipient not found (user profile does not exist)");
      }

      const tid = `anon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const msg = {
        tid,
        message,
        createdAt: new Date().toISOString(),
        recipient,
      };

      await this.db
        .insertInto("message")
        .values(msg)
        .onConflict((oc) => oc.column("tid").doNothing())
        .execute();

      return { success: true };
    } catch (err) {
      this.logger.error({ err, recipient }, "Failed to send message");
      throw new Error(
        err instanceof Error ? err.message : "Failed to send message"
      );
    }
  }

  /**
   * Delete a message
   * @param tid The message TID
   * @param userDid The user's DID
   * @param agent The ATP agent
   * @returns Success status
   */ async deleteMessage(
    tid: string,
    userDid: string,
    agent: Agent
  ): Promise<{ success: boolean }> {
    try {
      // Find the message and check ownership
      const message = await this.db
        .selectFrom("message")
        .selectAll()
        .where("tid", "=", tid)
        .executeTakeFirst();

      if (!message) {
        throw new Error("Message not found");
      }

      if (message.recipient !== userDid) {
        throw new Error("Not authorized to delete this message");
      }

      // Delete from PDS first — if this fails, the DB record is preserved
      // so the message won't be re-imported on the next bidirectional sync.
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: userDid,
          collection: ids.AppNavyfragenMessage,
          rkey: tid,
        });
      } catch (err) {
        this.logger.error(
          { error: err, tid },
          "Failed to delete message from PDS"
        );
        throw new Error("Failed to delete message from PDS");
      }

      await this.db.deleteFrom("message").where("tid", "=", tid).execute();

      return { success: true };
    } catch (err) {
      this.logger.error({ err, tid, userDid }, "Failed to delete message");
      throw new Error(
        err instanceof Error ? err.message : "Failed to delete message"
      );
    }
  }

  async respondToMessage(
    tid: string,
    did: string,
    recipient: string,
    original: string,
    response: string,
    includeQuestionAsImage: boolean,
    agent: Agent
  ): Promise<{ success: boolean; uri: string; link?: string }> {
    try {
      const handle = await this.resolver.resolveDidToHandle(did);
      const rt = new RichText({ text: response });
      await rt.detectFacets(agent);

      const postRecord: any = {
        text: rt.text,
        facets: rt.facets || [],
        createdAt: new Date().toISOString(),
      };

      if (includeQuestionAsImage) {
        const userSettings = await this.db
          .selectFrom("user_settings")
          .selectAll()
          .where("did", "=", did)
          .executeTakeFirst();

        const imageTheme = userSettings?.imageTheme ?? "default";

        const { imageBlob, imageAltText, width, height } =
          await imageGenerator.generateQuestionImage(
            original,
            this.logger,
            handle,
            imageTheme
          );

        if (!imageBlob) {
          this.logger.error("Image generation failed, no imageBlob returned");
          throw new Error("Image generation failed");
        }

        try {
          const uploadedImage = await agent.uploadBlob(imageBlob, {
            encoding: "image/png",
          });
          const imageEmbed: any = {
            image: uploadedImage.data.blob,
            alt: imageAltText || "Image of the anonymous question",
          };
          if (width && height) {
            imageEmbed.aspectRatio = { width, height };
          }
          postRecord.embed = {
            $type: "app.bsky.embed.images",
            images: [imageEmbed],
          };
        } catch (uploadErr) {
          this.logger.error(uploadErr, "Failed to upload image to Bluesky");
          throw new Error("Failed to upload image, try a text only response");
        }
      } else {
        const combinedText = `${response}\n\nAnon asked via 🔷💬📩: "${original}"`;
        const richTextWithQuestion = new RichText({ text: combinedText });
        await richTextWithQuestion.detectFacets(agent);
        postRecord.text = richTextWithQuestion.text;
        postRecord.facets = richTextWithQuestion.facets || [];
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
      return {
        success: true,
        uri: postRes.uri,
        link: webUrl || undefined,
      };
    } catch (err) {
      this.logger.error(
        { err, tid, did },
        "Error while trying to post response to Bluesky"
      );
      throw new Error("Failed to post to Bluesky");
    }
  }

  async deleteUserData(
    userDid: string,
    agent: Agent
  ): Promise<{ success: boolean }> {
    try {
      // Delete from PDS
      try {
        // Message IDs
        const rkeys = await this.db
          .selectFrom("message")
          .select(["tid"])
          .where("recipient", "=", userDid)
          .execute();

        if (rkeys.length === 0) {
          this.logger.info(
            { did: userDid },
            "No messages found for deletion in PDS"
          );
        }

        for (const rkey of rkeys) {
          await agent.com.atproto.repo.deleteRecord({
            repo: userDid,
            collection: ids.AppNavyfragenMessage,
            rkey: rkey.tid, // Use the TID as the rkey
          });
        }

        this.logger.info(
          { did: userDid },
          "Successfully deleted all messages from PDS"
        );
      } catch (err) {
        this.logger.error(
          { error: err, did: userDid },
          "Failed to delete messages from PDS"
        );
        throw new Error(
          "Failed to delete messages from PDS, but data deleted in the DB"
        );
      }

      // Delete all messages, user profile, and user settings for this DID
      await this.db
        .deleteFrom("message")
        .where("recipient", "=", userDid)
        .execute();
      await this.db
        .deleteFrom("user_profile")
        .where("did", "=", userDid)
        .execute();
      await this.db
        .deleteFrom("user_settings")
        .where("did", "=", userDid)
        .execute();

      return { success: true };
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to delete user data");
      throw new Error("Failed to delete user data");
    }
  }

  async syncMessages(
    userDid: string,
    agent: Agent
  ): Promise<{
    success: boolean;
    message?: string;
    syncedCount?: number;
    importedCount?: number;
    errorCount?: number;
    errors?: { tid: string; error: string }[];
  }> {
    try {
      // Fetch all existing PDS records first to avoid redundant pushes and enable pull
      const pdsRecords: { rkey: string; value: MessageSchemaRecord }[] = [];
      let cursor: string | undefined;
      do {
        const res = await agent.com.atproto.repo.listRecords({
          repo: userDid,
          collection: ids.AppNavyfragenMessage,
          limit: 100,
          cursor,
        });
        if (!res.success) break;
        for (const r of res.data.records) {
          const rkey = r.uri.split("/").pop()!;
          pdsRecords.push({ rkey, value: r.value as MessageSchemaRecord });
        }
        cursor = res.data.cursor;
      } while (cursor);

      const pdsRkeys = new Set(pdsRecords.map((r) => r.rkey));

      // Fetch local DB messages for the user
      const localMessages = await this.db
        .selectFrom("message")
        .selectAll()
        .where("recipient", "=", userDid)
        .execute();

      const localTids = new Set(localMessages.map((m) => m.tid));

      let syncedCount = 0;
      let importedCount = 0;
      let errorCount = 0;
      const syncErrors: { tid: string; error: string }[] = [];

      // Phase 1: Push DB messages that are missing from PDS (DB → PDS)
      for (const dbMessage of localMessages) {
        if (pdsRkeys.has(dbMessage.tid)) continue;

        const recordToCreate: MessageSchemaRecord = {
          $type: ids.AppNavyfragenMessage,
          createdAt: dbMessage.createdAt,
          message: dbMessage.message,
          recipient: dbMessage.recipient,
        };

        try {
          await agent.com.atproto.repo.createRecord({
            repo: agent.assertDid,
            collection: ids.AppNavyfragenMessage,
            rkey: dbMessage.tid,
            record: recordToCreate,
          });
          syncedCount++;
        } catch (err: any) {
          errorCount++;
          syncErrors.push({
            tid: dbMessage.tid,
            error: err.message || "Unknown error during PDS record creation",
          });
        }
      }

      // Phase 2: Import PDS records missing from DB (PDS → DB)
      for (const pdsRecord of pdsRecords) {
        if (localTids.has(pdsRecord.rkey)) continue;

        try {
          await this.db
            .insertInto("message")
            .values({
              tid: pdsRecord.rkey,
              message: pdsRecord.value.message,
              createdAt: pdsRecord.value.createdAt,
              recipient: pdsRecord.value.recipient,
            })
            .onConflict((oc) => oc.column("tid").doNothing())
            .execute();
          importedCount++;
        } catch (err: any) {
          errorCount++;
          syncErrors.push({
            tid: pdsRecord.rkey,
            error: err.message || "Unknown error during DB import",
          });
        }
      }

      this.logger.info(
        { did: userDid, syncedCount, importedCount, errorCount },
        "Bidirectional PDS sync completed."
      );

      return {
        success: true,
        syncedCount,
        importedCount,
        errorCount,
        errors: syncErrors,
      };
    } catch (err: any) {
      this.logger.error(
        { did: userDid, error: err },
        "Error during message sync process"
      );
      throw new Error("Failed to sync messages to PDS");
    }
  }
}
