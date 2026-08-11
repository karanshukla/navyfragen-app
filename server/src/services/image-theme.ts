import { type Database } from "../database/db";

export const DEFAULT_IMAGE_THEME = "default";

/**
 * Shared by the reply path and the async render pipeline: both have to agree on
 * the theme or a render is keyed under one theme and posted under another.
 */
export async function readImageTheme(db: Database, did: string): Promise<string> {
  const userSettings = await db
    .selectFrom("user_settings")
    .selectAll()
    .where("did", "=", did)
    .executeTakeFirst();
  return userSettings?.imageTheme ?? DEFAULT_IMAGE_THEME;
}
