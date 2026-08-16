/* v8 ignore start */
import { Agent } from "@atproto/api";
import { Logger } from "pino";

import type { Database } from "../database/db";
import type { IdResolver } from "@atproto/identity";
import { toDbBoolean } from "../lib/db-boolean";
import { withRetry } from "../lib/retry";

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

const USE_APP_DEFAULT = null;

const SETTINGS_DEFAULTS = {
  pdsSyncEnabled: toDbBoolean(true),
  imageTheme: "default",
  inboxEnabled: toDbBoolean(true),
  profanityFilterEnabled: toDbBoolean(false),
  customPrompt: USE_APP_DEFAULT,
  profileCardTheme: USE_APP_DEFAULT,
  touchpointLocale: USE_APP_DEFAULT,
} satisfies Omit<UserSettings, "did" | "createdAt">;

/**
 * @see [settings-service.test.ts](../tests/settings-service.test.ts) — pins that
 * a row created by a partial update leaves PDS sync off, unlike first-run.
 */
const SETTINGS_DEFAULTS_WITH_SYNC_OPT_IN = {
  ...SETTINGS_DEFAULTS,
  pdsSyncEnabled: toDbBoolean(false),
};

/** Every field is optional: the service persists only the keys present. */
export interface UpdatableSettings {
  pdsSyncEnabled?: boolean;
  imageTheme?: string;
  inboxEnabled?: boolean;
  profanityFilterEnabled?: boolean;
  customPrompt?: string | null;
  profileCardTheme?: string | null;
  touchpointLocale?: string | null;
}

const BOOLEAN_SETTINGS = [
  "pdsSyncEnabled",
  "inboxEnabled",
  "profanityFilterEnabled",
] as const satisfies readonly (keyof UpdatableSettings)[];

/**
 * Projects only the keys the caller actually supplied, so a /customise card
 * mutating one setting never clobbers the rest back to their defaults.
 */
function toSettingsColumns(updates: UpdatableSettings): Record<string, unknown> {
  const columns: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const isBooleanColumn = (BOOLEAN_SETTINGS as readonly string[]).includes(key);
    columns[key] = isBooleanColumn ? toDbBoolean(Boolean(value)) : value;
  }

  return columns;
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
      ...SETTINGS_DEFAULTS,
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
        const res = await withRetry(
          () =>
            agent.com.atproto.repo.listRecords({
              repo: userDid,
              collection: "app.navyfragen.message",
              limit: 100,
              cursor,
            }),
          this.logger,
          { did: userDid, op: "listRecords" }
        );
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
            ...SETTINGS_DEFAULTS_WITH_SYNC_OPT_IN,
            ...toSettingsColumns(updates),
            createdAt: new Date().toISOString(),
          })
          .execute();
      } else {
        await this.db
          .updateTable("user_settings")
          .set(toSettingsColumns(updates))
          .where("did", "=", userDid)
          .execute();
      }

      return await this.getUserSettings(userDid);
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to update user settings");
      throw new Error("Failed to update user settings", { cause: err });
    }
  }
  /* v8 ignore next 1 */
}
