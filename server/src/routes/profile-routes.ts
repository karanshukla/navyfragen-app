import express from "express";
import { param, validationResult } from "express-validator";
import type { AppContext } from "../index";

export function profileRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  const router = express.Router();

  // Public profile for a DID
  router.get(
    "/public-profile/:did",
    param("did").isString().notEmpty().withMessage("DID required"),
    checkValidation,
    handler(async (req, res) => {
      // ...existing code from /api/public-profile/:did...
    })
  );

  // Check if a DID exists
  router.get(
    "/user-exists/:did",
    param("did").isString().notEmpty().withMessage("DID required"),
    checkValidation,
    handler(async (req, res) => {
      // ...existing code from /api/user-exists/:did...
    })
  );

  return router;
}
