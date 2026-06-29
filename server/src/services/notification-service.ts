import { Logger } from "pino";
import { sendNotification, setVapidDetails } from "web-push";

import type { Database } from "../database/db";

import { env } from "#/lib/env";

/**
 * True only when all three VAPID values are present in the environment.
 * Reads from the validated, frozen `env` object (single source of truth for
 * server config). Tests toggle this by mocking `#/lib/env` via mock.module.
 */
export function isWebPushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

/**
 * Minimal in-process concurrency limiter (p-limit style). Returns a `run()`
 * that wraps an async task so at most `limit` run at once; the rest queue.
 * No new infrastructure, no worker threads — push delivery is I/O-bound, so
 * the event loop already handles it concurrently; this just caps the number
 * of simultaneous outbound HTTPS calls during a traffic spike.
 *
 * Exposed as a factory so the cap can be unit-tested in isolation against a
 * fresh instance, without disturbing the shared module-level limiter.
 */
export function createConcurrencyLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const scheduleNext = () => {
    while (active < limit) {
      const next = queue.shift();
      if (!next) break;
      active++;
      next();
    }
  };

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const exec = () => {
          task()
            .then(resolve, reject)
            .finally(() => {
              active--;
              scheduleNext();
            });
        };
        queue.push(exec);
        scheduleNext();
      });
    },
    get active() {
      return active;
    },
    get pending() {
      return queue.length;
    },
  };
}

/**
 * Cap on the number of `sendNotification` HTTPS calls in flight at once.
 * Shared across every NotificationService instance (there is one per route
 * module) because they share one Node process and one network egress.
 */
export const PUSH_CONCURRENCY_LIMIT = 10;
const pushLimiter = createConcurrencyLimiter(PUSH_CONCURRENCY_LIMIT);

export class NotificationService {
  constructor(
    private db: Database,
    private logger: Logger
  ) {}

  /**
   * The VAPID public key the browser needs to subscribe, or null when push is
   * not configured (so the controller can surface a "not available" response).
   */
  getVapidPublicKey(): string | null {
    return env.VAPID_PUBLIC_KEY || null;
  }

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
    const existing = await this.db
      .selectFrom("push_subscription")
      .selectAll()
      .where("endpoint", "=", endpoint)
      .executeTakeFirst();

    if (existing) {
      await this.db
        .updateTable("push_subscription")
        .set({ did, p256dh, auth })
        .where("endpoint", "=", endpoint)
        .execute();
    } else {
      await this.db
        .insertInto("push_subscription")
        .values({ did, endpoint, p256dh, auth, createdAt: new Date().toISOString() })
        .execute();
    }
    this.logger.info({ did }, "Push subscription saved");
  }

  /**
   * Remove a specific push subscription by endpoint (called on unsubscribe).
   */
  async deleteSubscription(did: string, endpoint: string): Promise<void> {
    await this.db
      .deleteFrom("push_subscription")
      .where("did", "=", did)
      .where("endpoint", "=", endpoint)
      .execute();
    this.logger.info({ did }, "Push subscription deleted");
  }

  /**
   * Remove all push subscriptions for a user (called on account deletion).
   */
  async deleteAllSubscriptionsForUser(did: string): Promise<void> {
    await this.db.deleteFrom("push_subscription").where("did", "=", did).execute();
    this.logger.info({ did }, "All push subscriptions deleted");
  }

  /**
   * Send a push notification to every subscription registered for a recipient.
   * No-ops when web push is not configured. Automatically removes subscriptions
   * that the push service reports as expired/gone (410/404).
   */
  async sendNewMessageNotification(recipientDid: string): Promise<void> {
    if (!isWebPushConfigured()) {
      this.logger.debug({ did: recipientDid }, "Web push not configured; skipping notification");
      return;
    }

    // Re-assert VAPID details on each send (cheap, idempotent). Wrapped so a
    // malformed subject never crashes the request — push just stays inert.
    try {
      setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    } catch (err) {
      this.logger.error({ err, did: recipientDid }, "Failed to configure VAPID details");
      return;
    }

    const subscriptions = await this.db
      .selectFrom("push_subscription")
      .selectAll()
      .where("did", "=", recipientDid)
      .execute();

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: "New anonymous question",
      body: "Someone sent you an anonymous question on Navyfragen!",
      url: "/messages",
    });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          // Gate the outbound HTTPS call through the shared concurrency limiter
          // so a burst of messages can't open hundreds of sockets at once.
          await pushLimiter.run(() =>
            sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
          );
        } catch (err) {
          const statusCode =
            err && typeof err === "object" && "statusCode" in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;
          // 410 Gone / 404 Not Found → subscription is no longer valid; clean it up
          if (statusCode === 410 || statusCode === 404) {
            await this.deleteSubscription(recipientDid, sub.endpoint);
            this.logger.info({ did: recipientDid }, "Removed expired push subscription");
          } else {
            this.logger.error({ err, did: recipientDid }, "Failed to send push notification");
          }
        }
      })
    );
  }
}
