/* v8 ignore next 1 */
import { Logger } from "pino";
// web-push is CJS whose named exports aren't statically detectable by Node's
// ESM loader (cjs-module-lexer), so we import the default and destructure.
import webPush from "web-push";
const { sendNotification, setVapidDetails } = webPush;

import type { Database } from "../database/db";

import { getServerMessages } from "../lib/i18n";

export interface ProfileResolver {
  resolveDidToHandle(did: string): Promise<string | undefined>;
}

// Read live from process.env rather than the frozen `env` snapshot, so a test
// can toggle VAPID on and off without reloading the module.
function readVapidConfigFromLiveEnv() {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "",
  };
}

export function isWebPushConfigured(): boolean {
  const { publicKey, privateKey, subject } = readVapidConfigFromLiveEnv();
  return Boolean(publicKey && privateKey && subject);
}

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

// Shared across every NotificationService instance (one per route module):
// they share one process and one network egress.
export const PUSH_CONCURRENCY_LIMIT = 10;
const pushLimiter = createConcurrencyLimiter(PUSH_CONCURRENCY_LIMIT);

export class NotificationService {
  constructor(
    private db: Database,
    private resolver: ProfileResolver,
    private logger: Logger
  ) {}

  getVapidPublicKey(): string | null {
    return readVapidConfigFromLiveEnv().publicKey || null;
  }

  /**
   * Upserts by (did, endpoint) so a device holds one row per signed-in account
   * instead of the newest account stealing the row. Single-statement because a
   * read-then-write races: two concurrent saves can both miss the existing row
   * and the second INSERT then violates the unique constraint (migration 008).
   */
  async saveSubscription(
    did: string,
    endpoint: string,
    p256dh: string,
    auth: string
  ): Promise<void> {
    await this.db
      .insertInto("push_subscription")
      .values({ did, endpoint, p256dh, auth, createdAt: new Date().toISOString() })
      .onConflict((oc) => oc.columns(["did", "endpoint"]).doUpdateSet({ p256dh, auth }))
      .execute();
    this.logger.info({ did }, "Push subscription saved");
  }

  /**
   * Given every account remembered on one browser, copies whichever device
   * subscriptions already exist for any of them onto the accounts still
   * missing one — so a device that has ever subscribed keeps every signed-in
   * account covered, not just whichever was active at subscribe time.
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

  async deleteSubscription(did: string, endpoint: string): Promise<void> {
    await this.db
      .deleteFrom("push_subscription")
      .where("did", "=", did)
      .where("endpoint", "=", endpoint)
      .execute();
    this.logger.info({ did }, "Push subscription deleted");
  }

  async deleteAllSubscriptionsForUser(did: string): Promise<void> {
    await this.db.deleteFrom("push_subscription").where("did", "=", did).execute();
    this.logger.info({ did }, "All push subscriptions deleted");
  }

  private applyVapidDetails(recipientDid: string): boolean {
    try {
      const { subject, publicKey, privateKey } = readVapidConfigFromLiveEnv();
      setVapidDetails(subject, publicKey, privateKey);
      return true;
    } catch (err) {
      this.logger.error({ err, did: recipientDid }, "Failed to configure VAPID details");
      return false;
    }
  }

  /**
   * A failed or missing settings read must not cost the recipient the
   * notification itself, only its language — so this never rejects.
   * @see [notification-service.test.ts](../tests/notification-service.test.ts)
   * — "still delivers the notification when the locale read fails".
   */
  private async readNotificationLocale(recipientDid: string): Promise<string> {
    try {
      const row = await this.db
        .selectFrom("user_settings")
        .select("uiLocale")
        .where("did", "=", recipientDid)
        .executeTakeFirst();
      return row?.uiLocale ?? "en";
    } catch (err) {
      this.logger.warn(
        { err, did: recipientDid },
        "Failed to read uiLocale for push notification; falling back to en"
      );
      return "en";
    }
  }

  /**
   * Names the recipient account in the payload because one device can hold
   * subscriptions for several accounts at once — the client uses `did`/`handle`
   * to tell them apart and switch to the right account on click, rather than
   * opening whichever account happens to be active in the browser.
   */
  private async buildNewMessagePayload(recipientDid: string): Promise<string> {
    const [handle, locale] = await Promise.all([
      this.resolver.resolveDidToHandle(recipientDid).catch(() => undefined),
      this.readNotificationLocale(recipientDid),
    ]);
    const messages = getServerMessages(locale);

    return JSON.stringify({
      title: handle ? messages.push.titleForHandle(handle) : messages.push.titleAnonymous,
      body: messages.push.body,
      url: "/messages",
      did: recipientDid,
      handle,
    });
  }

  private async deliverOrPrune(
    recipientDid: string,
    sub: { endpoint: string; p256dh: string; auth: string },
    payload: string
  ): Promise<void> {
    try {
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
      const subscriptionIsGone = statusCode === 410 || statusCode === 404;

      if (subscriptionIsGone) {
        await this.deleteSubscription(recipientDid, sub.endpoint);
        this.logger.info({ did: recipientDid }, "Removed expired push subscription");
      } else {
        this.logger.error({ err, did: recipientDid }, "Failed to send push notification");
      }
    }
  }

  async sendNewMessageNotification(recipientDid: string): Promise<void> {
    if (!isWebPushConfigured()) {
      this.logger.debug({ did: recipientDid }, "Web push not configured; skipping notification");
      return;
    }

    if (!this.applyVapidDetails(recipientDid)) return;

    const subscriptions = await this.db
      .selectFrom("push_subscription")
      .selectAll()
      .where("did", "=", recipientDid)
      .execute();

    if (subscriptions.length === 0) return;

    const payload = await this.buildNewMessagePayload(recipientDid);

    await Promise.allSettled(
      subscriptions.map((sub) => this.deliverOrPrune(recipientDid, sub, payload))
    );
  }
  /* v8 ignore next 1 */
}
