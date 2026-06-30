import express from "express";

import { MessageController } from "../controllers/message-controller";
import { MessageService } from "../services/message-service";
import { NotificationService } from "../services/notification-service";

import type { AppContext } from "../index";

export function messageRoutes(ctx: AppContext, handler: any, checkValidation: any) {
  // Initialize service and controller
  const messageService = new MessageService(ctx.db, ctx.resolver, ctx.logger);
  const notificationService = new NotificationService(ctx.db, ctx.logger);
  const messageController = new MessageController(
    messageService,
    ctx.logger,
    ctx,
    notificationService
  );

  const router = express.Router();

  // Define routes
  router.post(
    "/messages/example",
    messageController.validateAddExampleMessages,
    checkValidation,
    handler(messageController.addExampleMessages)
  );

  router.post(
    "/messages/respond",
    messageController.validateRespondToMessage,
    checkValidation,
    handler(messageController.respondToMessage)
  );

  router.post(
    "/messages/send",
    messageController.validateSendMessage,
    checkValidation,
    handler(messageController.sendMessage)
  );

  router.get("/messages/:recipient", handler(messageController.getMessages));

  router.delete("/messages/:tid", handler(messageController.deleteMessage));

  router.delete("/delete-account", handler(messageController.deleteAccount));

  router.post("/messages/sync", handler(messageController.syncMessages));

  return router;
}
