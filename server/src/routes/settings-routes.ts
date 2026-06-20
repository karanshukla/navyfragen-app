import express from "express";

import { SettingsController } from "../controllers/settings-controller";
import { SettingsService } from "../services/settings-service";

import type { AppContext } from "../index";

export function settingsRoutes(ctx: AppContext, handler: any, checkValidation: any) {
  // Initialize service and controller
  const settingsService = new SettingsService(ctx.db, ctx.logger);
  const settingsController = new SettingsController(settingsService, ctx.logger, ctx);

  const router = express.Router();
  // Define routes
  router.get("/settings", handler(settingsController.getSettings));
  router.get("/stats", handler(settingsController.getStats));
  router.get("/pds-info", handler(settingsController.getPdsInfo));

  router.post(
    "/settings",
    settingsController.validateUpdateSettings,
    checkValidation,
    handler(settingsController.updateSettings)
  );

  return router;
}
