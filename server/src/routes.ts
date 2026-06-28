import express from "express";
import { validationResult } from "express-validator";

import { authRoutes } from "./routes/auth-routes";
import { e2eAuthRoutes } from "./routes/e2e-auth-routes";
import { messageRoutes } from "./routes/message-routes";
import { notificationRoutes } from "./routes/notification-routes";
import { profileRoutes } from "./routes/profile-routes";
import { settingsRoutes } from "./routes/settings-routes";

import type { AppContext } from "#/index";

import { env } from "#/lib/env";

// Helper function for defining routes
const handler =
  (fn: express.Handler) =>
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

// Middleware for express-validator
function checkValidation(req: express.Request, res: express.Response, next: express.NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

export const createRouter = (ctx: AppContext) => {
  const router = express.Router();

  // When using a caddy proxy, add the /api to the frontend VITE_API URL env variable
  router.use(authRoutes(ctx, handler, checkValidation));
  router.use(messageRoutes(ctx, handler, checkValidation));
  router.use(profileRoutes(ctx, handler, checkValidation));
  router.use(settingsRoutes(ctx, handler, checkValidation));
  router.use(notificationRoutes(ctx, handler, checkValidation));

  // Two independent conditions must both be true:
  // 1. E2E_TESTING explicitly opted in
  // 2. NODE_ENV is not production (production deployments always set NODE_ENV=production)
  // This means accidentally leaking E2E_TESTING=true to Railway/prod cannot activate the bypass.
  if (env.E2E_TESTING && env.NODE_ENV !== "production") {
    router.use(e2eAuthRoutes(ctx, handler, checkValidation));
  }

  return router;
};
