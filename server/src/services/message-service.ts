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

      // Delete the message from the database
      await this.db.deleteFrom("message").where("tid", "=", tid).execute();

      // Delete from the PDS
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
        throw new Error(
          "Failed to delete message from PDS, but data deleted in the DB"
        );
      }

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
        const { imageBlob, imageAltText } =
          await imageGenerator.generateQuestionImage(
            original,
            this.logger,
            handle
          );

        if (!imageBlob) {
          this.logger.error("Image generation failed, no imageBlob returned");
          throw new Error("Image generation failed");
        }

        try {
          const uploadedImage = await agent.uploadBlob(imageBlob, {
            encoding: "image/png",
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
    errorCount?: number;
    errors?: { tid: string; error: string }[];
  }> {
    try {
      // Fetch messages from the local database for the user
      const localMessages = await this.db
        .selectFrom("message")
        .selectAll()
        .where("recipient", "=", userDid)
        .execute();

      if (localMessages.length === 0) {
        this.logger.info({ did: userDid }, "No local messages to sync to PDS.");
        return {
          success: true,
          message: "No local messages to sync.",
          syncedCount: 0,
          errorCount: 0,
          errors: [],
        };
      }

      let syncedCount = 0;
      let errorCount = 0;
      const syncErrors: { tid: string; error: string }[] = [];

      this.logger.info(
        { did: userDid, count: localMessages.length },
        `Starting PDS sync for ${localMessages.length} messages.`
      );

      for (const dbMessage of localMessages) {
        const rkey = dbMessage.tid;
        const recordToCreate: MessageSchemaRecord = {
          $type: ids.AppNavyfragenMessage,
          createdAt: dbMessage.createdAt,
          message: dbMessage.message,
          recipient: dbMessage.recipient,
        };

        try {
          const createResponse = await agent.com.atproto.repo.createRecord({
            repo: agent.assertDid,
            collection: ids.AppNavyfragenMessage,
            rkey: rkey,
            record: recordToCreate,
          });
          syncedCount++;
          this.logger.info(
            { did: userDid, rkey, uri: createResponse.data.uri },
            "Successfully synced message to PDS"
          );
        } catch (err: any) {
          errorCount++;
          const errorMessage =
            err.message || "Unknown error during PDS record creation";
          syncErrors.push({ tid: rkey, error: errorMessage });
        }
      }

      this.logger.info(
        { did: userDid, syncedCount, errorCount },
        "PDS sync completed."
      );

      return {
        success: true,
        syncedCount,
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
