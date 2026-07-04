import assert from "node:assert";
import { test, describe, beforeEach, mock } from "node:test";

import { generateVAPIDKeys } from "web-push";

import { NotificationService, createConcurrencyLimiter } from "../services/notification-service";

// Chainable DB builder mocks — match the pattern used across the server tests.
function makeSelectBuilder(existing: any, rows: any[]) {
  return {
    selectAll: mock.fn(function (this: any) {
      return this;
    }),
    where: mock.fn(function (this: any) {
      return this;
    }),
    executeTakeFirst: mock.fn(async () => existing),
    execute: mock.fn(async () => rows),
  };
}

function makeInsertBuilder() {
  return {
    values: mock.fn(function (this: any) {
      return this;
    }),
    execute: mock.fn(async () => ({})),
  };
}

function makeDeleteBuilder() {
  return {
    where: mock.fn(function (this: any) {
      return this;
    }),
    execute: mock.fn(async () => ({})),
  };
}

function makeUpdateBuilder() {
  return {
    set: mock.fn(function (this: any) {
      return this;
    }),
    where: mock.fn(function (this: any) {
      return this;
    }),
    execute: mock.fn(async () => ({})),
  };
}

describe("NotificationService", () => {
  let mockDb: any;
  let mockLogger: any;
  let mockResolver: any;
  let service: NotificationService;

  beforeEach(() => {
    mockLogger = {
      info: mock.fn(),
      error: mock.fn(),
      warn: mock.fn(),
      debug: mock.fn(),
    };
    mockResolver = {
      resolveDidToHandle: mock.fn(async () => "alice.test"),
    };
    mockDb = {
      selectFrom: mock.fn(() => makeSelectBuilder(undefined, [])),
      insertInto: mock.fn(() => makeInsertBuilder()),
      deleteFrom: mock.fn(() => makeDeleteBuilder()),
      updateTable: mock.fn(() => makeUpdateBuilder()),
    };
    service = new NotificationService(mockDb, mockResolver, mockLogger);
  });

  describe("saveSubscription", () => {
    test("inserts a new subscription when endpoint doesn't exist", async () => {
      const insertBuilder = makeInsertBuilder();
      mockDb.selectFrom = mock.fn(() => makeSelectBuilder(undefined, []));
      mockDb.insertInto = mock.fn(() => insertBuilder);

      await service.saveSubscription("did:foo", "https://push.example/sub", "p256", "auth");

      assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
      const valuesArg = insertBuilder.values.mock.calls[0].arguments[0];
      assert.strictEqual(valuesArg.did, "did:foo");
      assert.strictEqual(valuesArg.endpoint, "https://push.example/sub");
    });

    test("updates an existing subscription instead of inserting", async () => {
      const updateBuilder = makeUpdateBuilder();
      mockDb.selectFrom = mock.fn(() =>
        makeSelectBuilder({ endpoint: "https://push.example/sub" }, [])
      );
      mockDb.insertInto = mock.fn(() => makeInsertBuilder());
      mockDb.updateTable = mock.fn(() => updateBuilder);

      await service.saveSubscription("did:foo", "https://push.example/sub", "newp256", "newauth");

      assert.strictEqual(mockDb.insertInto.mock.calls.length, 0);
      assert.strictEqual(mockDb.updateTable.mock.calls.length, 1);
      const setArg = updateBuilder.set.mock.calls[0].arguments[0];
      assert.strictEqual(setArg.p256dh, "newp256");
    });
  });

  describe("deleteSubscription", () => {
    test("deletes from push_subscription by did + endpoint", async () => {
      const deleteBuilder = makeDeleteBuilder();
      mockDb.deleteFrom = mock.fn(() => deleteBuilder);

      await service.deleteSubscription("did:foo", "https://push.example/sub");

      assert.strictEqual(mockDb.deleteFrom.mock.calls.length, 1);
      // two .where() calls: did then endpoint
      assert.strictEqual(deleteBuilder.where.mock.calls.length, 2);
    });
  });

  describe("deleteAllSubscriptionsForUser", () => {
    test("deletes all subscriptions for a did", async () => {
      const deleteBuilder = makeDeleteBuilder();
      mockDb.deleteFrom = mock.fn(() => deleteBuilder);

      await service.deleteAllSubscriptionsForUser("did:foo");

      assert.strictEqual(mockDb.deleteFrom.mock.calls.length, 1);
      assert.strictEqual(deleteBuilder.where.mock.calls.length, 1);
    });
  });

  describe("getVapidPublicKey", () => {
    test("returns the env VAPID_PUBLIC_KEY when set", () => {
      const prev = process.env.VAPID_PUBLIC_KEY;
      process.env.VAPID_PUBLIC_KEY = "test-key";
      try {
        assert.strictEqual(service.getVapidPublicKey(), "test-key");
      } finally {
        process.env.VAPID_PUBLIC_KEY = prev;
      }
    });

    test("returns null when VAPID_PUBLIC_KEY is empty", () => {
      const prev = process.env.VAPID_PUBLIC_KEY;
      process.env.VAPID_PUBLIC_KEY = "";
      try {
        assert.strictEqual(service.getVapidPublicKey(), null);
      } finally {
        process.env.VAPID_PUBLIC_KEY = prev;
      }
    });
  });

  describe("sendNewMessageNotification", () => {
    test("no-ops (debug log) when VAPID is not configured", async () => {
      // VAPID vars are empty by default in the test env (test-bootstrap.js
      // doesn't set them), so this exercises the "not configured" branch.
      await service.sendNewMessageNotification("did:recipient");
      assert.strictEqual(mockLogger.debug.mock.calls.length, 1);
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 0);
    });

    test("skips handle resolution when the recipient has no subscriptions", async () => {
      const keys = generateVAPIDKeys();
      const prev = {
        pub: process.env.VAPID_PUBLIC_KEY,
        priv: process.env.VAPID_PRIVATE_KEY,
        subj: process.env.VAPID_SUBJECT,
      };
      process.env.VAPID_PUBLIC_KEY = keys.publicKey;
      process.env.VAPID_PRIVATE_KEY = keys.privateKey;
      process.env.VAPID_SUBJECT = "mailto:test@example.com";

      try {
        // Default mockDb.selectFrom resolves to an empty subscriptions array.
        await service.sendNewMessageNotification("did:recipient");

        assert.strictEqual(mockDb.selectFrom.mock.calls.length, 1);
        assert.strictEqual(mockResolver.resolveDidToHandle.mock.calls.length, 0);
      } finally {
        process.env.VAPID_PUBLIC_KEY = prev.pub;
        process.env.VAPID_PRIVATE_KEY = prev.priv;
        process.env.VAPID_SUBJECT = prev.subj;
      }
    });
  });
});

describe("createConcurrencyLimiter", () => {
  test("runs up to `limit` tasks concurrently, queuing the rest", async () => {
    const limiter = createConcurrencyLimiter(2);
    let active = 0;
    let maxActive = 0;
    const task = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
    };

    await Promise.all(Array.from({ length: 5 }, () => limiter.run(task)));

    assert.strictEqual(maxActive, 2, "never exceeded the concurrency limit");
  });

  test("propagates results and rejections faithfully", async () => {
    const limiter = createConcurrencyLimiter(3);
    const ok = await limiter.run(() => Promise.resolve(42));
    assert.strictEqual(ok, 42);

    await assert.rejects(
      limiter.run(() => Promise.reject(new Error("boom"))),
      /boom/
    );
  });

  test("resumes queue slots as tasks complete", async () => {
    const limiter = createConcurrencyLimiter(1);
    const order: number[] = [];
    const makeTask = (id: number) => async () => {
      order.push(id);
      await new Promise((r) => setTimeout(r, 5));
    };

    await Promise.all([
      limiter.run(makeTask(1)),
      limiter.run(makeTask(2)),
      limiter.run(makeTask(3)),
    ]);
    // With limit 1 they must run strictly in insertion order.
    assert.deepStrictEqual(order, [1, 2, 3]);
  });
});
