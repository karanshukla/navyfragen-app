import assert from "node:assert";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { test, describe, before, after, beforeEach, afterEach, mock } from "node:test";

// web-push is CJS whose named exports aren't statically detectable by Node's
// ESM loader (cjs-module-lexer), so import the default and destructure.
import webPush from "web-push";
const { generateVAPIDKeys } = webPush;

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

// A valid-shaped (but throwaway) push subscription keypair, so web-push's
// client-side payload encryption succeeds and the test actually reaches the
// network call instead of failing validation before it.
function makeSubscriptionKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey("base64url"),
    auth: crypto.randomBytes(16).toString("base64url"),
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

  describe("syncSubscriptionsAcrossAccounts", () => {
    test("no-ops when fewer than two accounts are given", async () => {
      await service.syncSubscriptionsAcrossAccounts(["did:foo"]);
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 0);
    });

    test("no-ops when none of the accounts have an existing subscription", async () => {
      mockDb.selectFrom = mock.fn(() => makeSelectBuilder(undefined, []));
      await service.syncSubscriptionsAcrossAccounts(["did:foo", "did:bar"]);
      assert.strictEqual(mockDb.insertInto.mock.calls.length, 0);
    });

    test("copies an existing device subscription to accounts still missing one", async () => {
      const rows = [
        { did: "did:foo", endpoint: "https://push.example/dev", p256dh: "p256", auth: "auth" },
      ];
      mockDb.selectFrom = mock.fn(() => makeSelectBuilder(undefined, rows));
      const insertBuilder = makeInsertBuilder();
      mockDb.insertInto = mock.fn(() => insertBuilder);

      await service.syncSubscriptionsAcrossAccounts(["did:foo", "did:bar"]);

      assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
      const valuesArg = insertBuilder.values.mock.calls[0].arguments[0];
      assert.strictEqual(valuesArg.did, "did:bar");
      assert.strictEqual(valuesArg.endpoint, "https://push.example/dev");
      assert.strictEqual(valuesArg.p256dh, "p256");
    });

    test("does not duplicate a row that already exists for that account", async () => {
      const rows = [
        { did: "did:foo", endpoint: "https://push.example/dev", p256dh: "p256", auth: "auth" },
        { did: "did:bar", endpoint: "https://push.example/dev", p256dh: "p256", auth: "auth" },
      ];
      mockDb.selectFrom = mock.fn(() => makeSelectBuilder(undefined, rows));
      const insertBuilder = makeInsertBuilder();
      mockDb.insertInto = mock.fn(() => insertBuilder);

      await service.syncSubscriptionsAcrossAccounts(["did:foo", "did:bar"]);

      assert.strictEqual(mockDb.insertInto.mock.calls.length, 0);
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

    test("returns early (no-op) when setVapidDetails throws for a malformed subject", async () => {
      const keys = generateVAPIDKeys();
      const prev = {
        pub: process.env.VAPID_PUBLIC_KEY,
        priv: process.env.VAPID_PRIVATE_KEY,
        subj: process.env.VAPID_SUBJECT,
      };
      process.env.VAPID_PUBLIC_KEY = keys.publicKey;
      process.env.VAPID_PRIVATE_KEY = keys.privateKey;
      process.env.VAPID_SUBJECT = "not-a-valid-subject";

      try {
        await service.sendNewMessageNotification("did:recipient");

        assert.strictEqual(mockLogger.error.mock.calls.length, 1);
        // Bails out before ever querying for subscriptions.
        assert.strictEqual(mockDb.selectFrom.mock.calls.length, 0);
      } finally {
        process.env.VAPID_PUBLIC_KEY = prev.pub;
        process.env.VAPID_PRIVATE_KEY = prev.priv;
        process.env.VAPID_SUBJECT = prev.subj;
      }
    });

    // These tests exercise the real `web-push` `sendNotification` call against a
    // local HTTPS server (self-signed cert) rather than mocking the module, so
    // they cover web-push's actual HTTP/encryption behavior end-to-end. (The
    // server is now native ESM, so `mock.module()` no longer needs a special
    // flag — these could be converted to mocks later if the local-server setup
    // becomes a maintenance burden.)
    describe("against a local HTTPS push endpoint", () => {
      let server: https.Server;
      let port: number;
      let nextStatus: number;
      let prevEnv: { pub?: string; priv?: string; subj?: string };
      let prevGlobalAgent: typeof https.globalAgent;

      before(() => {
        const certDir = fs.mkdtempSync(path.join(os.tmpdir(), "wp-test-certs-"));
        const keyPath = path.join(certDir, "key.pem");
        const certPath = path.join(certDir, "cert.pem");
        execFileSync("openssl", [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-keyout",
          keyPath,
          "-out",
          certPath,
          "-days",
          "1",
          "-nodes",
          "-subj",
          "/CN=127.0.0.1",
          // A SAN entry is required — modern Node/OpenSSL clients reject
          // certs that only match via the legacy CN fallback.
          "-addext",
          "subjectAltName=IP:127.0.0.1",
        ]);

        const certPem = fs.readFileSync(certPath);
        nextStatus = 201;
        server = https.createServer(
          { key: fs.readFileSync(keyPath), cert: certPem },
          (req, res) => {
            req.resume();
            req.on("end", () => {
              res.writeHead(nextStatus);
              res.end();
            });
          }
        );

        // Trust this run's throwaway CA specifically (scoped to the global
        // agent web-push falls back to), rather than disabling certificate
        // validation process-wide.
        prevGlobalAgent = https.globalAgent;
        https.globalAgent = new https.Agent({ ca: certPem });

        return new Promise<void>((resolve) => {
          server.listen(0, "127.0.0.1", () => {
            port = (server.address() as { port: number }).port;
            fs.rmSync(certDir, { recursive: true, force: true });
            resolve();
          });
        });
      });

      after(() => {
        https.globalAgent = prevGlobalAgent;
        return new Promise<void>((resolve) => server.close(() => resolve()));
      });

      beforeEach(() => {
        nextStatus = 201;
        const keys = generateVAPIDKeys();
        prevEnv = {
          pub: process.env.VAPID_PUBLIC_KEY,
          priv: process.env.VAPID_PRIVATE_KEY,
          subj: process.env.VAPID_SUBJECT,
        };
        process.env.VAPID_PUBLIC_KEY = keys.publicKey;
        process.env.VAPID_PRIVATE_KEY = keys.privateKey;
        process.env.VAPID_SUBJECT = "mailto:test@example.com";

        const subKeys = makeSubscriptionKeys();
        mockDb.selectFrom = mock.fn(() =>
          makeSelectBuilder(undefined, [
            {
              did: "did:recipient",
              endpoint: `https://127.0.0.1:${port}/sub`,
              p256dh: subKeys.p256dh,
              auth: subKeys.auth,
            },
          ])
        );
      });

      afterEach(() => {
        process.env.VAPID_PUBLIC_KEY = prevEnv.pub;
        process.env.VAPID_PRIVATE_KEY = prevEnv.priv;
        process.env.VAPID_SUBJECT = prevEnv.subj;
      });

      test("resolves the recipient's handle and sends successfully", async () => {
        await service.sendNewMessageNotification("did:recipient");

        assert.strictEqual(mockResolver.resolveDidToHandle.mock.calls.length, 1);
        assert.strictEqual(mockLogger.error.mock.calls.length, 0);
      });

      test("falls back to a generic no-op when handle resolution fails, but still sends", async () => {
        mockResolver.resolveDidToHandle = mock.fn(async () => {
          throw new Error("resolution failed");
        });

        await service.sendNewMessageNotification("did:recipient");

        assert.strictEqual(mockLogger.error.mock.calls.length, 0);
      });

      test("deletes the subscription when the push service reports 410 Gone", async () => {
        nextStatus = 410;
        const deleteBuilder = makeDeleteBuilder();
        mockDb.deleteFrom = mock.fn(() => deleteBuilder);

        await service.sendNewMessageNotification("did:recipient");

        assert.strictEqual(mockDb.deleteFrom.mock.calls.length, 1);
        // One info log from deleteSubscription itself, one from the "removed expired" note.
        assert.strictEqual(mockLogger.info.mock.calls.length, 2);
      });

      test("deletes the subscription when the push service reports 404 Not Found", async () => {
        nextStatus = 404;
        const deleteBuilder = makeDeleteBuilder();
        mockDb.deleteFrom = mock.fn(() => deleteBuilder);

        await service.sendNewMessageNotification("did:recipient");

        assert.strictEqual(mockDb.deleteFrom.mock.calls.length, 1);
      });

      test("logs an error and keeps the subscription for other failure statuses", async () => {
        nextStatus = 500;

        await service.sendNewMessageNotification("did:recipient");

        assert.strictEqual(mockDb.deleteFrom.mock.calls.length, 0);
        assert.strictEqual(mockLogger.error.mock.calls.length, 1);
      });

      test("logs an error (statusCode undefined) when the failure has no HTTP response at all", async () => {
        // A malformed subscription key fails web-push's own client-side validation
        // synchronously, before any network call — the resulting error has no
        // `statusCode` field, exercising the `undefined` fallback.
        mockDb.selectFrom = mock.fn(() =>
          makeSelectBuilder(undefined, [
            {
              did: "did:recipient",
              endpoint: `https://127.0.0.1:${port}/sub`,
              p256dh: "too-short",
              auth: "also-too-short",
            },
          ])
        );

        await service.sendNewMessageNotification("did:recipient");

        assert.strictEqual(mockDb.deleteFrom.mock.calls.length, 0);
        assert.strictEqual(mockLogger.error.mock.calls.length, 1);
      });
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

  test("exposes active/pending counts while tasks are in flight and queued", async () => {
    const limiter = createConcurrencyLimiter(1);
    let releaseFirst: () => void = () => {};
    const blocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const firstRun = limiter.run(() => blocked);
    const secondRun = limiter.run(() => Promise.resolve());
    // First task is active immediately; second is queued behind the limit of 1.
    assert.strictEqual(limiter.active, 1);
    assert.strictEqual(limiter.pending, 1);

    releaseFirst();
    await Promise.all([firstRun, secondRun]);
    assert.strictEqual(limiter.active, 0);
    assert.strictEqual(limiter.pending, 0);
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
