import express from "express";
import type { AppContext } from "../index";
import { MessageController } from "../controllers/message-controller";
import { MessageService } from "../services/message-service";

export function messageRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  // Initialize service and controller
  const messageService = new MessageService(ctx.db, ctx.resolver, ctx.logger);
  const messageController = new MessageController(
    messageService,
    ctx.logger,
    ctx
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
