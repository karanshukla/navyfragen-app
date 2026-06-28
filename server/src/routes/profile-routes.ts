import express from "express";

import { ProfileController } from "../controllers/profile-controller";
import { ProfileService } from "../services/profile-service";

import type { AppContext } from "../index";

export function profileRoutes(ctx: AppContext, handler: any, checkValidation: any) {
  // Initialize service and controller
  const profileService = new ProfileService(ctx.db, ctx.resolver, ctx.logger);
  const profileController = new ProfileController(profileService, ctx.logger, ctx);

  const router = express.Router();

  // Define routes
  router.get(
    "/public-profile/:did",
    profileController.validateGetPublicProfile,
    checkValidation,
    handler(profileController.getPublicProfile)
  );

  router.get(
    "/user-exists/:did",
    profileController.validateUserExists,
    checkValidation,
    handler(profileController.checkUserExists)
  );

  router.get("/friends", handler(profileController.getFriends));

  router.get("/check-bot-follow", handler(profileController.checkBotFollow));

  router.get(
    "/handle-pds/:handle",
    profileController.validateHandlePDS,
    checkValidation,
    handler(profileController.getHandlePDS)
  );

  router.get(
    "/handle-search",
    profileController.validateSearchHandles,
    checkValidation,
    handler(profileController.searchHandles)
  );

  router.get(
    "/resolve-handle/:handle",
    profileController.validateResolveHandle,
    checkValidation,
    handler(profileController.resolveHandle)
  );

  return router;
}
