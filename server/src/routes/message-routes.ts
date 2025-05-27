import express from "express";
import { body, validationResult } from "express-validator";
import { TID } from "@atproto/common";
import type { AppContext } from "../index";

export function messageRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  const router = express.Router();

  // Add example messages
  router.post(
    "/messages/example",
    body("recipient")
      .isString()
      .notEmpty()
      .withMessage("Recipient DID required"),
    checkValidation,
    handler(async (req, res) => {
      // ...existing code from /api/messages/example...
    })
  );

  // Respond to a message
  router.post(
    "/messages/respond",
    body("tid").isString().notEmpty().withMessage("tid required"),
    body("recipient").isString().notEmpty().withMessage("recipient required"),
    body("response")
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage("Response must be 1-500 chars"),
    checkValidation,
    handler(async (req, res) => {
      // ...existing code from /api/messages/respond...
    })
  );

  // Send anonymous message
  router.post(
    "/messages/send",
    body("recipient")
      .isString()
      .notEmpty()
      .withMessage("Recipient DID required"),
    body("message")
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage("Message must be 1-500 chars"),
    checkValidation,
    handler(async (req, res) => {
      // ...existing code from /api/messages/send...
    })
  );

  // Fetch messages for a user
  router.get(
    "/messages/:recipient",
    handler(async (req, res) => {
      // ...existing code from /api/messages/:recipient...
    })
  );

  // Delete a message
  router.delete(
    "/messages/:tid",
    handler(async (req, res) => {
      // ...existing code from /api/messages/:tid...
    })
  );

  return router;
}
