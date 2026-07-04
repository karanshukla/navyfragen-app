import express from "express";

import { NotificationController } from "../controllers/notification-controller";
import { NotificationService } from "../services/notification-service";

import type { AppContext } from "../index";

export function notificationRoutes(ctx: AppContext, handler: any, checkValidation: any) {
  const notificationService = new NotificationService(ctx.db, ctx.resolver, ctx.logger);
  const notificationController = new NotificationController(notificationService, ctx.logger);

  const router = express.Router();

  // Return the VAPID public key for client-side subscription setup
  router.get("/notifications/vapid-public-key", handler(notificationController.getVapidPublicKey));

  // Register a push subscription
  router.post(
    "/notifications/subscribe",
    notificationController.validateSubscribe,
    checkValidation,
    handler(notificationController.subscribe)
  );

  // Remove a push subscription
  router.delete(
    "/notifications/subscribe",
    notificationController.validateUnsubscribe,
    checkValidation,
    handler(notificationController.unsubscribe)
  );

  return router;
}
