/* v8 ignore start */
import { Agent } from "@atproto/api";
import { Logger } from "pino";

import type { Database } from "../database/db";
import type { IdResolver } from "@atproto/identity";

export interface UserSettings {
  did: string;
  pdsSyncEnabled: number;
  imageTheme: string;
  inboxEnabled: number;
  profanityFilterEnabled: number;
  customPrompt: string | null;
  profileCardTheme: string | null;
  touchpointLocale: string | null;
  createdAt: string;
}

/**
 * The subset of `UserSettings` a client is allowed to update. Every field is
 * optional so a /customise card can mutate just its own setting; the service
 * persists only the keys present.
 */
export interface UpdatableSettings {
  pdsSyncEnabled?: boolean;
  imageTheme?: string;
  inboxEnabled?: boolean;
  profanityFilterEnabled?: boolean;
  customPrompt?: string | null;
  profileCardTheme?: string | null;
  touchpointLocale?: string | null;
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
      throw new Error("Failed to fetch user settings", { cause: err });
    }
  }

  async createDefaultSettings(userDid: string): Promise<UserSettings> {
    const defaultSettings: UserSettings = {
      did: userDid,
      pdsSyncEnabled: 1, // Default to enabled (SQLite uses 1/0 for booleans)
      imageTheme: "default",
      inboxEnabled: 1, // Inbox open by default
      profanityFilterEnabled: 0, // Opt-in wordlist screening (#58)
      customPrompt: null, // null = use the default ask-card headline
      profileCardTheme: null, // null = the default --nf-grad-mark gradient
      touchpointLocale: null, // null = English
      createdAt: new Date().toISOString(),
    };

    try {
      await this.db.insertInto("user_settings").values(defaultSettings).execute();

      return defaultSettings;
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to create default user settings");
      throw new Error("Failed to create default user settings", { cause: err });
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
      throw new Error("Failed to fetch user stats", { cause: err });
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
    updates: UpdatableSettings
  ): Promise<UserSettings | undefined> {
    try {
      const existingSettings = await this.getUserSettings(userDid);

      if (!existingSettings) {
        await this.db
          .insertInto("user_settings")
          .values({
            did: userDid,
            pdsSyncEnabled: updates.pdsSyncEnabled ? 1 : 0,
            imageTheme: updates.imageTheme ?? "default",
            inboxEnabled: updates.inboxEnabled === false ? 0 : 1,
            profanityFilterEnabled: updates.profanityFilterEnabled ? 1 : 0,
            customPrompt: updates.customPrompt ?? null,
            profileCardTheme: updates.profileCardTheme ?? null,
            touchpointLocale: updates.touchpointLocale ?? null,
            createdAt: new Date().toISOString(),
          })
          .execute();
      } else {
        // Build a set of only the fields the caller provided, so a card
        // mutating one setting doesn't clobber the others to their defaults.
        const set: Record<string, unknown> = {};
        if (updates.pdsSyncEnabled !== undefined) {
          set.pdsSyncEnabled = updates.pdsSyncEnabled ? 1 : 0;
        }
        if (updates.imageTheme !== undefined) set.imageTheme = updates.imageTheme;
        if (updates.inboxEnabled !== undefined) {
          set.inboxEnabled = updates.inboxEnabled ? 1 : 0;
        }
        if (updates.profanityFilterEnabled !== undefined) {
          set.profanityFilterEnabled = updates.profanityFilterEnabled ? 1 : 0;
        }
        if (updates.customPrompt !== undefined) set.customPrompt = updates.customPrompt;
        if (updates.profileCardTheme !== undefined) {
          set.profileCardTheme = updates.profileCardTheme;
        }
        if (updates.touchpointLocale !== undefined) {
          set.touchpointLocale = updates.touchpointLocale;
        }

        await this.db.updateTable("user_settings").set(set).where("did", "=", userDid).execute();
      }

      return await this.getUserSettings(userDid);
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to update user settings");
      throw new Error("Failed to update user settings", { cause: err });
    }
  }
  /* v8 ignore next 1 */
}
