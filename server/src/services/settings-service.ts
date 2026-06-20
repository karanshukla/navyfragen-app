/* v8 ignore start */
import { Agent } from "@atproto/api";
import { Logger } from "pino";

import type { Database } from "../database/db";
import type { IdResolver } from "@atproto/identity";

export interface UserSettings {
  did: string;
  pdsSyncEnabled: number;
  imageTheme: string;
  createdAt: string;
}

export class SettingsService {
  constructor(
    private db: Database,
    private logger: Logger
  ) {}
  /* v8 ignore stop */

  async getUserSettings(userDid: string): Promise<UserSettings | undefined> {
    try {
      return await this.db
        .selectFrom("user_settings")
        .selectAll()
        .where("did", "=", userDid)
        .executeTakeFirst();
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to fetch user settings");
      throw new Error("Failed to fetch user settings");
    }
  }

  async createDefaultSettings(userDid: string): Promise<UserSettings> {
    const defaultSettings: UserSettings = {
      did: userDid,
      pdsSyncEnabled: 1, // Default to enabled (SQLite uses 1/0 for booleans)
      imageTheme: "default",
      createdAt: new Date().toISOString(),
    };

    try {
      await this.db.insertInto("user_settings").values(defaultSettings).execute();

      return defaultSettings;
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to create default user settings");
      throw new Error("Failed to create default user settings");
    }
  }

  async getStats(userDid: string): Promise<{
    messageCount: number;
    memberSince: string | null;
  }> {
    try {
      const countResult = await this.db
        .selectFrom("message")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("recipient", "=", userDid)
        .executeTakeFirst();

      const profile = await this.db
        .selectFrom("user_profile")
        .select("createdAt")
        .where("did", "=", userDid)
        .executeTakeFirst();

      return {
        messageCount: Number(countResult?.count ?? 0),
        memberSince: profile?.createdAt ?? null,
      };
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to fetch user stats");
      throw new Error("Failed to fetch user stats");
    }
  }

  async getPdsInfo(
    userDid: string,
    agent: Agent,
    idResolver: IdResolver
  ): Promise<{ pdsUrl: string | null; recordCount: number }> {
    let pdsUrl: string | null = null;
    try {
      const atprotoData = await idResolver.did.resolveAtprotoData(userDid);
      pdsUrl = atprotoData?.pds ?? null;
    } catch (err) {
      this.logger.warn({ err, did: userDid }, "Failed to resolve PDS URL from DID document");
    }

    let recordCount = 0;
    try {
      let cursor: string | undefined;
      for (let page = 0; page < 10; page++) {
        const res = await agent.com.atproto.repo.listRecords({
          repo: userDid,
          collection: "app.navyfragen.message",
          limit: 100,
          cursor,
        });
        if (!res.success) break;
        recordCount += res.data.records.length;
        cursor = res.data.cursor;
        if (!cursor) break;
      }
    } catch (err) {
      this.logger.warn({ err, did: userDid }, "Failed to count PDS records");
    }

    return { pdsUrl, recordCount };
  }

  async updateSettings(
    userDid: string,
    pdsSyncEnabled: boolean,
    imageTheme: string
  ): Promise<UserSettings | undefined> {
    // Convert boolean to 1/0 for SQLite compatibility
    const syncEnabled = pdsSyncEnabled ? 1 : 0;

    try {
      const existingSettings = await this.getUserSettings(userDid);

      if (!existingSettings) {
        await this.db
          .insertInto("user_settings")
          .values({
            did: userDid,
            pdsSyncEnabled: syncEnabled,
            imageTheme: imageTheme,
            createdAt: new Date().toISOString(),
          })
          .execute();
      } else {
        await this.db
          .updateTable("user_settings")
          .set({
            pdsSyncEnabled: syncEnabled,
            imageTheme: imageTheme,
          })
          .where("did", "=", userDid)
          .execute();
      }

      return await this.getUserSettings(userDid);
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to update user settings");
      throw new Error("Failed to update user settings");
    }
  }
  /* v8 ignore next 1 */
}
