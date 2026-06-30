import express from "express";
import { body } from "express-validator";
import { Logger } from "pino";

import { NotificationService } from "../services/notification-service";

export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private logger: Logger
  ) {}

  /**
   * Return the server's VAPID public key so the client can subscribe.
   * Responds 501 when web push is not configured, so the client can hide the
   * opt-in UI until the server has VAPID keys.
   *
   * GET /notifications/vapid-public-key
   */
  getVapidPublicKey = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const vapidPublicKey = this.notificationService.getVapidPublicKey();
    if (!vapidPublicKey) {
      return res.status(501).json({ error: "Web push not configured" });
    }
    return res.json({ vapidPublicKey });
  };

  /**
   * Validation rules for POST /notifications/subscribe
   */
  validateSubscribe = [
    body("endpoint").isURL().withMessage("endpoint must be a valid URL"),
    body("keys.p256dh").isString().notEmpty().withMessage("keys.p256dh is required"),
    body("keys.auth").isString().notEmpty().withMessage("keys.auth is required"),
  ];

  /**
   * Save a push subscription for the authenticated user.
   *
   * POST /notifications/subscribe
   * Body: { endpoint: string; keys: { p256dh: string; auth: string } }
   */
  subscribe = async (req: express.Request, res: express.Response): Promise<express.Response> => {
    const did = req.session?.did;
    if (!did) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    // Don't accept subscriptions when the server can't actually deliver pushes
    if (!this.notificationService.getVapidPublicKey()) {
      return res.status(501).json({ error: "Web push not configured" });
    }

    const { endpoint, keys } = req.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    try {
      await this.notificationService.saveSubscription(did, endpoint, keys.p256dh, keys.auth);
      this.logger.info({ did }, "Push subscription registered");
      return res.status(201).json({ ok: true });
    } catch (err) {
      this.logger.error({ err, did }, "Failed to save push subscription");
      return res.status(500).json({ error: "Failed to save subscription" });
    }
  };

  /**
   * Validation rules for DELETE /notifications/subscribe
   */
  validateUnsubscribe = [body("endpoint").isURL().withMessage("endpoint must be a valid URL")];

  /**
   * Remove a push subscription for the authenticated user.
   *
   * DELETE /notifications/subscribe
   * Body: { endpoint: string }
   */
  unsubscribe = async (req: express.Request, res: express.Response): Promise<express.Response> => {
    const did = req.session?.did;
    if (!did) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    const { endpoint } = req.body as { endpoint: string };

    try {
      await this.notificationService.deleteSubscription(did, endpoint);
      this.logger.info({ did }, "Push subscription removed");
      return res.json({ ok: true });
    } catch (err) {
      this.logger.error({ err, did }, "Failed to delete push subscription");
      return res.status(500).json({ error: "Failed to delete subscription" });
    }
  };
}
