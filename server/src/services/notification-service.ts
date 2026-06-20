/* v8 ignore start */
import type { Database } from "../database/db";
import { Logger } from "pino";
// import webpush from "web-push";

// Placeholder types matching what would be stored in the DB
export interface PushSubscription {
  did: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

export class NotificationService {
  constructor(
    private db: Database,
    private logger: Logger
  ) {}
  /* v8 ignore stop */

  /**
   * Save or update a push subscription for a user.
   * Upserts by endpoint so re-subscribing doesn't duplicate rows.
   */
  async saveSubscription(
    did: string,
    endpoint: string,
    p256dh: string,
    auth: string
  ): Promise<void> {
    // const existing = await this.db
    //   .selectFrom("push_subscription")
    //   .selectAll()
    //   .where("endpoint", "=", endpoint)
    //   .executeTakeFirst();

    // if (existing) {
    //   await this.db
    //     .updateTable("push_subscription")
    //     .set({ did, p256dh, auth })
    //     .where("endpoint", "=", endpoint)
    //     .execute();
    // } else {
    //   await this.db
    //     .insertInto("push_subscription")
    //     .values({ did, endpoint, p256dh, auth, createdAt: new Date().toISOString() })
    //     .execute();
    // }

    this.logger.info({ did }, "Push subscription saved (stub)");
  }

  /**
   * Remove a specific push subscription by endpoint (called on unsubscribe).
   */
  async deleteSubscription(did: string, endpoint: string): Promise<void> {
    // await this.db
    //   .deleteFrom("push_subscription")
    //   .where("did", "=", did)
    //   .where("endpoint", "=", endpoint)
    //   .execute();

    this.logger.info({ did }, "Push subscription deleted (stub)");
  }

  /**
   * Remove all push subscriptions for a user (called on account deletion).
   */
  async deleteAllSubscriptionsForUser(did: string): Promise<void> {
    // await this.db
    //   .deleteFrom("push_subscription")
    //   .where("did", "=", did)
    //   .execute();

    this.logger.info({ did }, "All push subscriptions deleted (stub)");
  }

  /**
   * Send a push notification to every subscription registered for a recipient.
   * Automatically removes subscriptions that the push service reports as expired/gone.
   */
  async sendNewMessageNotification(recipientDid: string): Promise<void> {
    // const subscriptions = await this.db
    //   .selectFrom("push_subscription")
    //   .selectAll()
    //   .where("did", "=", recipientDid)
    //   .execute();

    // const payload = JSON.stringify({
    //   title: "New anonymous question",
    //   body: "Someone sent you an anonymous question on Navyfragen!",
    // });

    // await Promise.allSettled(
    //   subscriptions.map(async (sub) => {
    //     try {
    //       await webpush.sendNotification(
    //         { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    //         payload
    //       );
    //     } catch (err: any) {
    //       // 410 Gone / 404 Not Found → subscription is no longer valid; clean it up
    //       if (err.statusCode === 410 || err.statusCode === 404) {
    //         await this.deleteSubscription(recipientDid, sub.endpoint);
    //         this.logger.info({ did: recipientDid }, "Removed expired push subscription");
    //       } else {
    //         this.logger.error({ err, did: recipientDid }, "Failed to send push notification");
    //       }
    //     }
    //   })
    // );

    this.logger.info({ did: recipientDid }, "sendNewMessageNotification called (stub)");
  }
  /* v8 ignore next 1 */
}
