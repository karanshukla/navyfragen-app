import express from "express";
import { body, param } from "express-validator";
import { MessageService } from "../services/message-service";
import { Logger } from "pino";
import { initializeAgentFromSession } from "#/auth/session-agent";
import type { AppContext } from "../index";

export class MessageController {
  constructor(
    private messageService: MessageService,
    private logger: Logger,
    private ctx: AppContext
  ) {}

  /**
   * Validation for adding example messages
   */
  validateAddExampleMessages = [
    body("recipient")
      .isString()
      .notEmpty()
      .withMessage("Recipient DID required"),
  ];

  /**
   * Add example messages for a user
   */
  addExampleMessages = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const recipient = req.session?.did;
    if (!recipient) {
      return res.status(403).json({ error: "Recipient DID required" });
    }

    try {
      const messages = await this.messageService.addExampleMessages(recipient);
      return res.json({ messages });
    } catch (err) {
      this.logger.error({ err, recipient }, "Failed to add example messages");
      return res.status(500).json({ error: "Failed to add example messages" });
    }
  };

  /**
   * Validation for responding to a message
   */
  validateRespondToMessage = [
    body("tid").isString().notEmpty().withMessage("Message TID required"),
    body("recipient")
      .isString()
      .notEmpty()
      .withMessage("Recipient DID required"),
    body("original")
      .isString()
      .notEmpty()
      .withMessage("Original message required"),
    body("response")
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage("Response must be 1-500 chars"),
    body("includeQuestionAsImage").isBoolean().optional(),
  ];

  /**
   * Respond to a message and post to Bluesky
   */
  respondToMessage = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const { tid, recipient, original, response, includeQuestionAsImage } =
      req.body;

    if (!tid || !recipient || !response) {
      this.logger.warn(
        { tid, recipient, response },
        "Missing required fields in respond endpoint"
      );
      return res.status(400).json({ error: "Missing required fields" });
    }

    const did = req.session?.did;
    if (!did) {
      this.logger.warn("No authenticated user session found");
      return res.status(403).json({ error: "Not authenticated" });
    }

    const agent = await initializeAgentFromSession(req, this.ctx);
    if (!agent) {
      this.logger.warn({ did }, "No agent could be initialized from session");
      return res.json({ isLoggedIn: false, profile: null, did: null });
    }

    try {
      const result = await this.messageService.respondToMessage(
        tid,
        did,
        recipient,
        original,
        response,
        includeQuestionAsImage || false,
        agent
      );
      return res.json(result);
    } catch (err: any) {
      this.logger.error(
        { err, tid, did },
        "Error in /messages/respond endpoint while trying to post to Bluesky"
      );
      return res
        .status(500)
        .json({ error: err.message || "Failed to post to Bluesky" });
    }
  };

  /**
   * Validation for sending a message
   */
  validateSendMessage = [
    body("recipient")
      .isString()
      .notEmpty()
      .withMessage("Recipient DID required"),
    body("message")
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage("Message must be 1-500 chars"),
  ];

  /**
   * Send an anonymous message
   */
  sendMessage = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const { recipient, message } = req.body;

    if (!recipient || !message) {
      return res.status(400).json({ error: "Recipient and message required" });
    }

    try {
      const result = await this.messageService.sendMessage(recipient, message);
      return res.json(result);
    } catch (err: any) {
      return res.status(err.message.includes("not found") ? 404 : 500).json({
        error: err.message || "Failed to send message",
      });
    }
  };

  /**
   * Get messages for a user
   */
  getMessages = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const recipient = req.session?.did;

    if (!recipient) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    try {
      const messages = await this.messageService.getMessages(recipient);
      return res.json({ messages });
    } catch (err: any) {
      if (err.message.includes("not exist")) {
        return res
          .status(404)
          .json({ error: "User not found (user profile does not exist)" });
      }
      return res.status(500).json({ error: "Failed to fetch messages" });
    }
  };

  /**
   * Delete a message
   */
  deleteMessage = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const { tid } = req.params;

    if (!tid) {
      return res.status(400).json({ error: "Message TID required" });
    }

    const userSessionDid = req.session?.did;
    if (!userSessionDid) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    const agent = await initializeAgentFromSession(req, this.ctx);
    if (!agent) {
      this.logger.warn(
        { userSessionDid },
        "No agent could be initialized from session"
      );
      return res.json({ isLoggedIn: false, profile: null, did: null });
    }

    try {
      await this.messageService.deleteMessage(tid, userSessionDid, agent);
      return res.json({ success: true });
    } catch (err: any) {
      const status = err.message.includes("not found")
        ? 404
        : err.message.includes("Not authorized")
          ? 403
          : 500;

      return res
        .status(status)
        .json({ error: err.message || "Failed to delete message" });
    }
  };

  /**
   * Delete all user data
   */
  deleteAccount = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const userSessionDid = req.session?.did;

    if (!userSessionDid) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    const agent = await initializeAgentFromSession(req, this.ctx);
    if (!agent) {
      return res.status(401).json({
        error:
          "Authentication failed - could not initialize agent or retrieve user DID",
      });
    }

    try {
      await this.messageService.deleteUserData(userSessionDid, agent);

      // Invalidate session
      req.session = null; // Clear the session

      return res.json({ success: true });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete account data" });
    }
  };

  /**
   * Sync messages to PDS
   */
  syncMessages = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const userSessionDid = req.session?.did;

    if (!userSessionDid) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    // Stopgap for now
    const userSettings = await this.ctx.db
      .selectFrom("user_settings")
      .selectAll()
      .where("did", "=", userSessionDid)
      .executeTakeFirst();

    if (!userSettings || !userSettings?.pdsSyncEnabled) {
      return res
        .status(200)
        .json({ success: true, message: "PDS sync is disabled" });
    }

    // Initialize the agent for the authenticated user session
    const agent = await initializeAgentFromSession(req, this.ctx);

    if (!agent) {
      return res.status(401).json({
        error: "Authentication failed - could not initialize agent",
      });
    }

    try {
      const syncResult = await this.messageService.syncMessages(
        userSessionDid,
        agent
      );
      return res.json(syncResult);
    } catch (err: any) {
      return res.status(500).json({
        error: "Failed to sync messages to PDS",
        details: err.message,
      });
    }
  };
}
