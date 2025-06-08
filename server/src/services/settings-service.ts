import type { Database } from "../database/db";
import { Logger } from "pino";

export interface UserSettings {
  did: string;
  pdsSyncEnabled: number;
  createdAt: string;
}

export class SettingsService {
  constructor(
    private db: Database,
    private logger: Logger
  ) {}

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
      createdAt: new Date().toISOString(),
    };

    try {
      await this.db
        .insertInto("user_settings")
        .values(defaultSettings)
        .execute();

      return defaultSettings;
    } catch (err) {
      this.logger.error(
        { err, did: userDid },
        "Failed to create default user settings"
      );
      throw new Error("Failed to create default user settings");
    }
  }

  async updateSettings(
    userDid: string,
    pdsSyncEnabled: boolean
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
            createdAt: new Date().toISOString(),
          })
          .execute();
      } else {
        await this.db
          .updateTable("user_settings")
          .set({
            pdsSyncEnabled: syncEnabled,
          })
          .where("did", "=", userDid)
          .execute();
      }

      return await this.getUserSettings(userDid);
    } catch (err) {
      this.logger.error(
        { err, did: userDid },
        "Failed to update user settings"
      );
      throw new Error("Failed to update user settings");
    }
  }
}
