/* v8 ignore start */
import express from "express";
import { body } from "express-validator";
import { Logger } from "pino";

import { SettingsService } from "../services/settings-service";

import type { AppContext } from "../index";

import { initializeAgentFromSession } from "#/auth/session-agent";

export class SettingsController {
  constructor(
    private settingsService: SettingsService,
    private logger: Logger,
    private ctx: AppContext
  ) {}
  /* v8 ignore stop */

  /**
   * Get the user's settings or create default ones if they don't exist
   */
  getSettings = async (req: express.Request, res: express.Response): Promise<express.Response> => {
    const userSessionDid = req.session?.did;

    if (!userSessionDid) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    try {
      let userSettings = await this.settingsService.getUserSettings(userSessionDid);

      if (!userSettings) {
        // Create default settings if they don't exist
        userSettings = await this.settingsService.createDefaultSettings(userSessionDid);
      }

      return res.json(userSettings);
    } catch (err) {
      this.logger.error({ err, did: userSessionDid }, "Failed to fetch user settings");
      return res.status(500).json({ error: "Failed to fetch user settings" });
    }
  };

  /**
   * Get account stats for the logged-in user
   */
  getStats = async (req: express.Request, res: express.Response): Promise<express.Response> => {
    const userSessionDid = req.session?.did;

    if (!userSessionDid) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    try {
      const stats = await this.settingsService.getStats(userSessionDid);
      return res.json(stats);
    } catch (err) {
      this.logger.error({ err, did: userSessionDid }, "Failed to fetch user stats");
      return res.status(500).json({ error: "Failed to fetch user stats" });
    }
  };

  /**
   * Get PDS URL and navyfragen record count for the logged-in user
   */
  getPdsInfo = async (req: express.Request, res: express.Response): Promise<express.Response> => {
    const userDid = req.session?.did;
    if (!userDid) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    const agent = await initializeAgentFromSession(req, this.ctx);
    if (!agent) {
      return res.status(401).json({ error: "Session expired" });
    }

    try {
      const info = await this.settingsService.getPdsInfo(userDid, agent, this.ctx.idResolver);
      return res.json(info);
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to fetch PDS info");
      return res.status(500).json({ error: "Failed to fetch PDS info" });
    }
  };

  /**
   * Validate request for updating settings.
   *
   * Every field is optional — the /customise page persists one card's setting
   * at a time, so only validate the keys a client actually sent. Null is a
   * valid value for the nullable columns (it means "use the default").
   */
  validateUpdateSettings = [
    body("pdsSyncEnabled")
      .optional()
      .isBoolean()
      .withMessage("pdsSyncEnabled must be a boolean value"),
    body("imageTheme")
      .optional({ nullable: true })
      .isString()
      .withMessage("imageTheme must be a string")
      .notEmpty()
      .withMessage("imageTheme cannot be empty"),
    body("inboxEnabled").optional().isBoolean().withMessage("inboxEnabled must be a boolean value"),
    body("profanityFilterEnabled")
      .optional()
      .isBoolean()
      .withMessage("profanityFilterEnabled must be a boolean value"),
    body("customPrompt")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 100 })
      .withMessage("customPrompt must be a string of at most 100 chars"),
    body("profileCardTheme")
      .optional({ nullable: true })
      .isString()
      .withMessage("profileCardTheme must be a string"),
    body("touchpointLocale")
      .optional({ nullable: true })
      .isString()
      .withMessage("touchpointLocale must be a string"),
  ];
  /**
   * Update the user's settings
   */
  updateSettings = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const userSessionDid = req.session?.did;

    if (!userSessionDid) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    try {
      const updatedSettings = await this.settingsService.updateSettings(userSessionDid, {
        pdsSyncEnabled:
          req.body.pdsSyncEnabled === undefined ? undefined : req.body.pdsSyncEnabled === true,
        imageTheme: req.body.imageTheme,
        inboxEnabled:
          req.body.inboxEnabled === undefined ? undefined : req.body.inboxEnabled === true,
        profanityFilterEnabled:
          req.body.profanityFilterEnabled === undefined
            ? undefined
            : req.body.profanityFilterEnabled === true,
        customPrompt: req.body.customPrompt,
        profileCardTheme: req.body.profileCardTheme,
        touchpointLocale: req.body.touchpointLocale,
      });
      this.logger.info({ did: userSessionDid, updates: req.body }, "Settings updated");
      return res.json(updatedSettings);
    } catch (err) {
      this.logger.error({ err, did: userSessionDid }, "Failed to update user settings");
      return res.status(500).json({ error: "Failed to update user settings" });
    }
  };
  /* v8 ignore next 1 */
}
