import express from "express";
import type { AppContext } from "../index";
import { SettingsController } from "../controllers/settings-controller";
import { SettingsService } from "../services/settings-service";

export function settingsRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  // Initialize service and controller
  const settingsService = new SettingsService(ctx.db, ctx.logger);
  const settingsController = new SettingsController(
    settingsService,
    ctx.logger,
    ctx
  );

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

  router.get("/themes", handler(settingsController.getThemes));

  return router;
}
