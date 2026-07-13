/* v8 ignore next 1 */
import { Logger } from "pino";
// web-push is CJS whose named exports aren't statically detectable by Node's
// ESM loader (cjs-module-lexer), so we import the default and destructure.
import webPush from "web-push";
const { sendNotification, setVapidDetails } = webPush;

import type { Database } from "../database/db";

/**
 * Minimal shape NotificationService needs from the app's DID resolver, so
 * tests can stub it without pulling in the real AT Protocol resolution.
 */
export interface ProfileResolver {
  resolveDidToHandle(did: string): Promise<string | undefined>;
}

// VAPID config is read live from process.env (rather than the frozen `env`
// snapshot) so tests can toggle it per-case without reloading the module.
// All three reads below share this single source.
function readVapidConfig() {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "",
  };
}

/**
 * True only when all three VAPID values are present in the environment.
 */
export function isWebPushConfigured(): boolean {
  const { publicKey, privateKey, subject } = readVapidConfig();
  return Boolean(publicKey && privateKey && subject);
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
    private resolver: ProfileResolver,
    private logger: Logger
  ) {}

  /**
   * The VAPID public key the browser needs to subscribe, or null when push is
   * not configured (so the controller can surface a "not available" response).
   */
  getVapidPublicKey(): string | null {
    return readVapidConfig().publicKey || null;
  }

  /**
   * Save or update a push subscription for a user.
   * Upserts by (did, endpoint) so a single device can hold a separate row
   * per signed-in account instead of the newest account stealing the row.
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
      .where("did", "=", did)
      .executeTakeFirst();

    if (existing) {
      await this.db
        .updateTable("push_subscription")
        .set({ p256dh, auth })
        .where("endpoint", "=", endpoint)
        .where("did", "=", did)
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
   * Make push notifications device-wide: given every account remembered on
   * one browser, copy whichever (endpoint, keys) rows already exist for any
   * of them onto the accounts still missing a row. Called after enabling
   * push and after switching accounts, so a device that's ever subscribed
   * keeps every signed-in account covered, not just whichever was active at
   * subscribe time.
   */
  async syncSubscriptionsAcrossAccounts(dids: string[]): Promise<void> {
    if (dids.length < 2) return;

    const rows = await this.db
      .selectFrom("push_subscription")
      .selectAll()
      .where("did", "in", dids)
      .execute();
    if (rows.length === 0) return;

    const devices = new Map<string, { p256dh: string; auth: string }>();
    for (const row of rows) {
      if (!devices.has(row.endpoint)) {
        devices.set(row.endpoint, { p256dh: row.p256dh, auth: row.auth });
      }
    }

    const existingPairs = new Set(rows.map((row) => `${row.did}:${row.endpoint}`));
    const missing: Promise<void>[] = [];
    for (const did of dids) {
      for (const [endpoint, keys] of devices) {
        if (!existingPairs.has(`${did}:${endpoint}`)) {
          missing.push(this.saveSubscription(did, endpoint, keys.p256dh, keys.auth));
        }
      }
    }
    await Promise.all(missing);
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
      const { subject, publicKey, privateKey } = readVapidConfig();
      setVapidDetails(subject, publicKey, privateKey);
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

    // A device can hold a push subscription for several accounts at once,
    // so more than one account's notifications can land here side by side.
    // Naming the recipient account up front (and passing its DID along) lets
    // the client tell them apart and auto-switch to the right account on
    // click, since clicking one shouldn't open whichever account happens to
    // be active in the browser.
    const handle = await this.resolver.resolveDidToHandle(recipientDid).catch(() => undefined);

    const payload = JSON.stringify({
      title: handle ? `New question for @${handle}` : "New anonymous question",
      body: "Someone sent you an anonymous question on Navyfragen!",
      url: "/messages",
      did: recipientDid,
      handle,
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
  /* v8 ignore next 1 */
}
