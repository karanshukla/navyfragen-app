import express from "express";
import type { AppContext } from "../index";
import { SettingsController } from "../controllers/settingsController";
import { SettingsService } from "../services/settingsService";

export function settingsRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  // Initialize service and controller
  const settingsService = new SettingsService(ctx.db, ctx.logger);
  const settingsController = new SettingsController(
    settingsService,
    ctx.logger
  );

  const router = express.Router();
  // Define routes
  router.get("/settings", handler(settingsController.getSettings));

  router.post(
    "/settings",
    settingsController.validateUpdateSettings,
    checkValidation,
    handler(settingsController.updateSettings)
  );

  return router;
}
