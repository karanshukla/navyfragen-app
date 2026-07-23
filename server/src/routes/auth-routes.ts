import express from "express";
import { body } from "express-validator";

import { AuthController } from "../controllers/auth-controller";

import type { AppContext } from "../index";

export function authRoutes(
  ctx: AppContext,
  handler: (fn: express.Handler) => express.Handler,
  checkValidation: express.RequestHandler
) {
  const router = express.Router();
  const controller = new AuthController(ctx);

  // Login handler
  router.post(
    "/login",
    body("handle").isString().isLength({ min: 1, max: 64 }).withMessage("Invalid handle"),
    checkValidation,
    handler(controller.login.bind(controller))
  );

  // Logout handler
  router.post("/logout", handler(controller.logout.bind(controller)));

  // Session check, we want to keep the client authenticated with ATProto
  router.get("/session", handler(controller.session.bind(controller)));

  // Switch the active account (multi-account). Only DIDs already remembered
  // in the signed cookie-session can be switched to (enforced by the controller).
  router.post(
    "/accounts/switch",
    body("did").isString().isLength({ min: 1, max: 512 }).withMessage("did is required"),
    checkValidation,
    handler(controller.switchAccount.bind(controller))
  );

  // OAuth metadata, just for compatibility
  router.get("/client-metadata.json", handler(controller.clientMetadata.bind(controller)));

  // OAuth callback
  router.get("/oauth/callback", handler(controller.oauthCallback.bind(controller)));

  router.post("/oauth/consume", handler(controller.oauthConsume.bind(controller)));

  return router;
}
