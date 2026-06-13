import { test, describe, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { NotificationService } from "../services/notification-service";

describe("NotificationService", () => {
  let mockDb: any;
  let mockLogger: any;
  let service: NotificationService;

  beforeEach(() => {
    mockLogger = {
      info: mock.fn(),
      error: mock.fn(),
      warn: mock.fn(),
      debug: mock.fn(),
    };
    mockDb = {};
    service = new NotificationService(mockDb, mockLogger);
  });

  test("saveSubscription logs info (stub)", async () => {
    await service.saveSubscription("did:foo", "https://push.example.com/sub", "p256dh-key", "auth-key");
    assert.strictEqual(mockLogger.info.mock.calls.length, 1);
    const logArg = mockLogger.info.mock.calls[0].arguments[0];
    assert.strictEqual(logArg.did, "did:foo");
  });

  test("deleteSubscription logs info (stub)", async () => {
    await service.deleteSubscription("did:foo", "https://push.example.com/sub");
    assert.strictEqual(mockLogger.info.mock.calls.length, 1);
    const logArg = mockLogger.info.mock.calls[0].arguments[0];
    assert.strictEqual(logArg.did, "did:foo");
  });

  test("deleteAllSubscriptionsForUser logs info (stub)", async () => {
    await service.deleteAllSubscriptionsForUser("did:foo");
    assert.strictEqual(mockLogger.info.mock.calls.length, 1);
    const logArg = mockLogger.info.mock.calls[0].arguments[0];
    assert.strictEqual(logArg.did, "did:foo");
  });

  test("sendNewMessageNotification logs info (stub)", async () => {
    await service.sendNewMessageNotification("did:recipient");
    assert.strictEqual(mockLogger.info.mock.calls.length, 1);
    const logArg = mockLogger.info.mock.calls[0].arguments[0];
    assert.strictEqual(logArg.did, "did:recipient");
  });
});
