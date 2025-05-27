import express from "express";
import { validationResult } from "express-validator";
import { authRoutes } from "./routes/auth-routes";
import { messageRoutes } from "./routes/message-routes";
import { profileRoutes } from "./routes/profile-routes";
import type { AppContext } from "#/index";

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

  // in the frontend the API URL must include the /api prefix
  router.use(authRoutes(ctx, handler, checkValidation));
  router.use(messageRoutes(ctx, handler, checkValidation));
  router.use(profileRoutes(ctx, handler, checkValidation));

  return router;
};
