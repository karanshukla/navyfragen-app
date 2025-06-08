import express from "express";
import type { AppContext } from "../index";
import { ProfileController } from "../controllers/profile-controller";
import { ProfileService } from "../services/profile-service";

export function profileRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  // Initialize service and controller
  const profileService = new ProfileService(ctx.db, ctx.resolver, ctx.logger);
  const profileController = new ProfileController(profileService, ctx.logger);

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

  router.get(
    "/resolve-handle/:handle",
    profileController.validateResolveHandle,
    checkValidation,
    handler(profileController.resolveHandle)
  );

  return router;
}
