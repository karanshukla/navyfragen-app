/* v8 ignore start */
import { AppBskyEmbedImages, AppBskyFeedPost, RichText, Agent } from "@atproto/api";
import { Logger } from "pino";

import { type Database } from "../database/db";
import { errorMessage } from "../lib/errors";
import { containsProfanity } from "../lib/profanity";
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

interface SyncOutcome {
  count: number;
  errors: { tid: string; error: string }[];
}

const EXAMPLE_QUESTIONS = [
  "Do you like cats?",
  "Do you like dogs?",
  "What's your favorite movie?",
  "If you could travel anywhere, where would you go?",
  "What's something most people don't know about you?",
  "What's the best piece of advice you've ever received?",
  "What are you currently obsessed with?",
  "What's your hot take on something totally mundane?",
];

export class MessageService {
  constructor(
    private db: Database,
    private resolver: ProfileResolver,
    private logger: Logger
  ) {}
  /* v8 ignore stop */

  private async userProfileExists(did: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("user_profile")
      .select("did")
      .where("did", "=", did)
      .executeTakeFirst();
    return Boolean(row);
  }

  private async readInboxMessages(recipient: string): Promise<Message[]> {
    return await this.db
      .selectFrom("message")
      .selectAll()
      .where("recipient", "=", recipient)
      .orderBy("createdAt desc")
      .execute();
  }

  private async insertMessagesIgnoringDuplicates(messages: Message[]): Promise<void> {
    await this.db
      .insertInto("message")
      .values(messages)
      .onConflict((oc) => oc.column("tid").doNothing())
      .execute();
  }

  private async readIntakeSettings(recipient: string) {
    return await this.db
      .selectFrom("user_settings")
      .select(["inboxEnabled", "profanityFilterEnabled"])
      .where("did", "=", recipient)
      .executeTakeFirst();
  }

  async getMessages(recipient: string): Promise<Message[]> {
    try {
      if (!(await this.userProfileExists(recipient))) {
        throw new Error("User profile does not exist");
      }
      return await this.readInboxMessages(recipient);
    } catch (err) {
      this.logger.error({ err, recipient }, "Failed to fetch messages");
      throw new Error("Failed to fetch messages", { cause: err });
    }
  }

  async addExampleMessages(recipient: string): Promise<Message[]> {
    try {
      const now = new Date();
      const examples = EXAMPLE_QUESTIONS.map((message, i) => ({
        tid: `example-${i + 1}-${Date.now()}`,
        message,
        createdAt: new Date(now.getTime() + i * 1000).toISOString(),
        recipient,
      }));

      await this.insertMessagesIgnoringDuplicates(examples);

      return await this.getMessages(recipient);
    } catch (err) {
      this.logger.error({ err, recipient }, "Failed to add example messages");
      throw new Error("Failed to add example messages", { cause: err });
    }
  }

  async sendMessage(recipient: string, message: string): Promise<{ success: boolean }> {
    try {
      if (!(await this.userProfileExists(recipient))) {
        throw new Error("Recipient not found (user profile does not exist)");
      }

      const intakeSettings = await this.readIntakeSettings(recipient);

      if (intakeSettings && !intakeSettings.inboxEnabled) {
        throw new Error("This inbox is closed and not accepting new messages");
      }

      if (intakeSettings?.profanityFilterEnabled && containsProfanity(message)) {
        return this.dropWithoutTellingSender(recipient);
      }

      const tid = `anon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await this.insertMessagesIgnoringDuplicates([
        { tid, message, createdAt: new Date().toISOString(), recipient },
      ]);

      this.logger.debug({ recipient, tid }, "Message saved to DB");
      return { success: true };
    } catch (err) {
      this.logger.error({ err, recipient }, "Failed to send message");
      throw new Error(err instanceof Error ? err.message : "Failed to send message", {
        cause: err,
      });
    }
  }

  /**
   * @see [message-service.test.ts](../tests/message-service.test.ts) — pins that
   * a flagged message still answers success and is never inserted, so a sender
   * cannot probe the filter.
   */
  private dropWithoutTellingSender(recipient: string): { success: boolean } {
    this.logger.info({ recipient }, "Message silently dropped (profanity filter)");
    return { success: true };
  }

  async deleteMessage(tid: string, userDid: string, agent: Agent): Promise<{ success: boolean }> {
    try {
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

      await this.db.deleteFrom("message").where("tid", "=", tid).execute();
      this.deletePdsRecordInBackground(tid, userDid, agent);

      return { success: true };
    } catch (err) {
      this.logger.error({ err, tid, userDid }, "Failed to delete message");
      throw new Error(err instanceof Error ? err.message : "Failed to delete message", {
        cause: err,
      });
    }
  }

  private deletePdsRecordInBackground(tid: string, userDid: string, agent: Agent): void {
    agent.com.atproto.repo
      .deleteRecord({
        repo: userDid,
        collection: ids.AppNavyfragenMessage,
        rkey: tid,
      })
      .catch((err) => {
        this.logger.error({ err, tid }, "Background PDS delete failed");
      });
  }

  private async toRichTextFields(text: string, agent: Agent) {
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    return { text: rt.text, facets: rt.facets || [] };
  }

  private async resolveReplyReference(
    replyTo: { uri: string },
    agent: Agent
  ): Promise<AppBskyFeedPost.Record["reply"]> {
    const uriParts = replyTo.uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (!uriParts) throw new Error("Invalid parent post URI");
    const [, repo, collection, rkey] = uriParts;
    const parentRecord = await agent.com.atproto.repo.getRecord({ repo, collection, rkey });
    if (!parentRecord.data.cid) throw new Error("Could not resolve CID for parent post");
    return {
      root: { uri: replyTo.uri, cid: parentRecord.data.cid },
      parent: { uri: replyTo.uri, cid: parentRecord.data.cid },
    };
  }

  private async readImageTheme(did: string): Promise<string> {
    const userSettings = await this.db
      .selectFrom("user_settings")
      .selectAll()
      .where("did", "=", did)
      .executeTakeFirst();
    return userSettings?.imageTheme ?? "default";
  }

  private async buildQuestionImageEmbed(
    question: string,
    did: string,
    handle: string | undefined,
    agent: Agent
  ): Promise<AppBskyFeedPost.Record["embed"]> {
    const theme = await this.readImageTheme(did);
    const { imageBlob, imageAltText, width, height } = await imageGenerator.generateQuestionImage(
      question,
      this.logger,
      handle,
      theme
    );

    if (!imageBlob) {
      throw new Error(
        "Image generation failed — the image service may still be starting up. Please try again in a moment."
      );
    }

    const uploadedImage = await agent.uploadBlob(imageBlob, { encoding: "image/png" });
    const imageEmbed: AppBskyEmbedImages.Image = {
      image: uploadedImage.data.blob,
      alt: imageAltText || "Image of the anonymous question",
    };
    if (width && height) {
      imageEmbed.aspectRatio = { width, height };
    }
    return { $type: "app.bsky.embed.images", images: [imageEmbed] };
  }

  private async resolveBskyWebUrl(postUri: string, agent: Agent): Promise<string | undefined> {
    const match = postUri.match(/^at:\/\/(.+?)\/app\.bsky\.feed\.post\/(.+)$/);
    if (!match) return undefined;

    const [, authorDid, rkey] = match;
    const profileHandle = await agent.app.bsky.actor
      .getProfile({ actor: authorDid })
      .then((res) => res?.data?.handle)
      .catch(() => undefined);

    return `https://bsky.app/profile/${profileHandle || authorDid}/post/${encodeURIComponent(rkey)}`;
  }

  async respondToMessage(
    tid: string,
    did: string,
    recipient: string,
    original: string,
    response: string,
    includeQuestionAsImage: boolean,
    agent: Agent,
    replyTo?: { uri: string; cid?: string }
  ): Promise<{ success: boolean; uri: string; cid: string; link?: string }> {
    try {
      const handle = await this.resolver.resolveDidToHandle(did);

      const postRecord: Partial<AppBskyFeedPost.Record> = {
        ...(await this.toRichTextFields(response, agent)),
        createdAt: new Date().toISOString(),
      };

      if (replyTo) {
        postRecord.reply = await this.resolveReplyReference(replyTo, agent);
      }

      if (includeQuestionAsImage) {
        postRecord.embed = await this.buildQuestionImageEmbed(original, did, handle, agent);
      } else {
        Object.assign(
          postRecord,
          await this.toRichTextFields(`${response}\n\nAnon asked via 🔷💬📩: "${original}"`, agent)
        );
      }

      const postRes = await agent.post(postRecord);
      this.logger.debug({ tid, did, uri: postRes.uri }, "Response posted to Bluesky");

      return {
        success: true,
        uri: postRes.uri,
        cid: postRes.cid,
        link: await this.resolveBskyWebUrl(postRes.uri, agent),
      };
    } catch (err) {
      this.logger.error({ err, tid, did }, "Error while trying to post response to Bluesky");
      throw new Error(err instanceof Error ? err.message : "Failed to post to Bluesky", {
        cause: err,
      });
    }
  }

  private async deleteAllPdsMessages(userDid: string, agent: Agent): Promise<void> {
    try {
      const rkeys = await this.db
        .selectFrom("message")
        .select(["tid"])
        .where("recipient", "=", userDid)
        .execute();

      if (rkeys.length === 0) {
        this.logger.info({ did: userDid }, "No messages found for deletion in PDS");
      }

      for (const rkey of rkeys) {
        await agent.com.atproto.repo.deleteRecord({
          repo: userDid,
          collection: ids.AppNavyfragenMessage,
          rkey: rkey.tid,
        });
      }

      this.logger.info({ did: userDid }, "Successfully deleted all messages from PDS");
    } catch (err) {
      this.logger.error({ error: err, did: userDid }, "Failed to delete messages from PDS");
      throw new Error("Failed to delete messages from PDS, but data deleted in the DB", {
        cause: err,
      });
    }
  }

  private async deleteAllUserRowsAtomically(userDid: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("message").where("recipient", "=", userDid).execute();
      await trx.deleteFrom("user_profile").where("did", "=", userDid).execute();
      await trx.deleteFrom("user_settings").where("did", "=", userDid).execute();
    });
  }

  async deleteUserData(userDid: string, agent: Agent): Promise<{ success: boolean }> {
    try {
      // PDS deletion runs before (and outside) the transaction so network calls
      // never hold a DB connection open.
      await this.deleteAllPdsMessages(userDid, agent);
      await this.deleteAllUserRowsAtomically(userDid);

      return { success: true };
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to delete user data");
      throw new Error("Failed to delete user data", { cause: err });
    }
  }

  private async listAllPdsMessages(
    userDid: string,
    agent: Agent
  ): Promise<{ rkey: string; value: MessageSchemaRecord }[]> {
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
    return pdsRecords;
  }

  private async pushMissingToPds(
    localMessages: Message[],
    pdsRecords: { rkey: string }[],
    agent: Agent
  ): Promise<SyncOutcome> {
    const pdsRkeys = new Set(pdsRecords.map((r) => r.rkey));
    const outcome: SyncOutcome = { count: 0, errors: [] };

    for (const dbMessage of localMessages) {
      if (pdsRkeys.has(dbMessage.tid)) continue;

      try {
        await agent.com.atproto.repo.createRecord({
          repo: agent.assertDid,
          collection: ids.AppNavyfragenMessage,
          rkey: dbMessage.tid,
          record: {
            $type: ids.AppNavyfragenMessage,
            createdAt: dbMessage.createdAt,
            message: dbMessage.message,
            recipient: dbMessage.recipient,
          } satisfies MessageSchemaRecord,
        });
        outcome.count++;
      } catch (err: unknown) {
        outcome.errors.push({
          tid: dbMessage.tid,
          error: errorMessage(err) || "Unknown error during PDS record creation",
        });
      }
    }
    return outcome;
  }

  private async importMissingFromPds(
    pdsRecords: { rkey: string; value: MessageSchemaRecord }[],
    localMessages: Message[]
  ): Promise<SyncOutcome> {
    const localTids = new Set(localMessages.map((m) => m.tid));
    const outcome: SyncOutcome = { count: 0, errors: [] };

    for (const pdsRecord of pdsRecords) {
      if (localTids.has(pdsRecord.rkey)) continue;

      try {
        await this.insertMessagesIgnoringDuplicates([
          {
            tid: pdsRecord.rkey,
            message: pdsRecord.value.message,
            createdAt: pdsRecord.value.createdAt,
            recipient: pdsRecord.value.recipient,
          },
        ]);
        outcome.count++;
      } catch (err: unknown) {
        outcome.errors.push({
          tid: pdsRecord.rkey,
          error: errorMessage(err) || "Unknown error during DB import",
        });
      }
    }
    return outcome;
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
      const pdsRecords = await this.listAllPdsMessages(userDid, agent);
      const localMessages = await this.readInboxMessages(userDid);

      const pushOutcome = await this.pushMissingToPds(localMessages, pdsRecords, agent);
      const importOutcome = await this.importMissingFromPds(pdsRecords, localMessages);

      const syncedCount = pushOutcome.count;
      const importedCount = importOutcome.count;
      const syncErrors = [...pushOutcome.errors, ...importOutcome.errors];
      const errorCount = syncErrors.length;

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
    } catch (err: unknown) {
      this.logger.error({ did: userDid, error: err }, "Error during message sync process");
      throw new Error("Failed to sync messages to PDS", { cause: err });
    }
  }
  /* v8 ignore next 1 */
}
