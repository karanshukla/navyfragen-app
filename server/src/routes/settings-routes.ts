import express from "express";
import { param, validationResult, body } from "express-validator";
import type { AppContext } from "../index";

export function settingsRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  const router = express.Router();
  router.get(
    "/settings",
    handler(async (req: express.Request, res: express.Response) => {
      const userSessionDid = req.session?.did;
      if (!userSessionDid) {
        return res.status(403).json({ error: "Not authenticated" });
      }
      try {
        const userSettings = await ctx.db
          .selectFrom("user_settings")
          .selectAll()
          .where("did", "=", userSessionDid)
          .executeTakeFirst();
        if (!userSettings) {
          // Create default settings if they don't exist
          const defaultSettings = {
            did: userSessionDid,
            pdsSyncEnabled: 1, // Default to enabled (SQLite uses 1/0 for booleans)
            createdAt: new Date().toISOString(),
          };

          await ctx.db
            .insertInto("user_settings")
            .values(defaultSettings)
            .execute();

          return res.json(defaultSettings);
        }

        return res.json(userSettings);
      } catch (err) {
        ctx.logger.error(
          { err, did: userSessionDid },
          "Failed to fetch user settings"
        );
        return res.status(500).json({ error: "Failed to fetch user settings" });
      }
    })
  );

  router.post(
    "/settings",
    [
      body("pdsSyncEnabled")
        .isBoolean()
        .withMessage("pdsSyncEnabled must be a boolean value"),
    ],
    handler(async (req: express.Request, res: express.Response) => {
      const userSessionDid = req.session?.did;
      if (!userSessionDid) {
        return res.status(403).json({ error: "Not authenticated" });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      } // Convert boolean to 1/0 for SQLite compatibility
      const pdsSyncEnabled = req.body.pdsSyncEnabled === true ? 1 : 0;

      try {
        // Check if user settings exist
        const existingSettings = await ctx.db
          .selectFrom("user_settings")
          .selectAll()
          .where("did", "=", userSessionDid)
          .executeTakeFirst();
        if (!existingSettings) {
          // Create new user settings if they don't exist
          await ctx.db
            .insertInto("user_settings")
            .values({
              did: userSessionDid,
              pdsSyncEnabled: pdsSyncEnabled ? 1 : 0, // Convert boolean to 1/0 for SQLite
              createdAt: new Date().toISOString(),
            })
            .execute();
        } else {
          // Update existing user settings
          await ctx.db
            .updateTable("user_settings")
            .set({
              pdsSyncEnabled: pdsSyncEnabled ? 1 : 0, // Convert boolean to 1/0 for SQLite
            })
            .where("did", "=", userSessionDid)
            .execute();
        }

        // Get the updated or new settings
        const updatedSettings = await ctx.db
          .selectFrom("user_settings")
          .selectAll()
          .where("did", "=", userSessionDid)
          .executeTakeFirst();

        return res.json(updatedSettings);
      } catch (err) {
        ctx.logger.error(
          { err, did: userSessionDid },
          "Failed to update user settings"
        );
        return res
          .status(500)
          .json({ error: "Failed to update user settings" });
      }
    })
  );

  return router;
}
