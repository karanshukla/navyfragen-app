import express from "express";
import { validationResult } from "express-validator";
import { authRoutes } from "./routes/auth-routes";
import { messageRoutes } from "./routes/message-routes";
import { profileRoutes } from "./routes/profile-routes";
import type { AppContext } from "#/index";
import { settingsRoutes } from "./routes/settings-routes";

// Helper function for defining routes
const handler =
  (fn: express.Handler) =>
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

// Middleware for express-validator
function checkValidation(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
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
  return router;
};
