import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { SettingsService, UserSettings } from "../services/settings-service";

interface MockDB {
  user_settings: UserSettings;
}

describe("SettingsService", () => {
  const mockLogger = {
    error: mock.fn(),
    info: mock.fn(),
    debug: mock.fn(),
  };

  const mockSelectBuilder = {
    selectAll() {
      return this;
    },
    where() {
      return this;
    },
    executeTakeFirst: async () => undefined as UserSettings | undefined,
  };

  let lastValuesArg: any;
  const mockInsertBuilder = {
    values(arg: any) {
      lastValuesArg = arg;
      return this;
    },
    execute: async () => ({}),
  };

  const mockUpdateBuilder = {
    set() {
      return this;
    },
    where() {
      return this;
    },
    execute: async () => ({}),
  };

  const mockDb = {
    selectFrom: mock.fn(() => mockSelectBuilder),
    insertInto: mock.fn(() => mockInsertBuilder),
    updateTable: mock.fn(() => mockUpdateBuilder),
  };

  let settingsService: SettingsService;
  let executeTakeFirstQueue: Array<UserSettings | undefined> = [];

  beforeEach(() => {
    mockLogger.error.mock.resetCalls();
    mockLogger.info.mock.resetCalls();
    mockLogger.debug.mock.resetCalls();

    mockDb.selectFrom.mock.resetCalls();
    mockDb.insertInto.mock.resetCalls();
    mockDb.updateTable.mock.resetCalls();

    executeTakeFirstQueue = [];
    mockSelectBuilder.executeTakeFirst = async () =>
      executeTakeFirstQueue.shift();
    mockInsertBuilder.execute = async () => ({});
    mockUpdateBuilder.execute = async () => ({});
    lastValuesArg = undefined;

    settingsService = new SettingsService(mockDb as any, mockLogger as any);
  });

  describe("getUserSettings", () => {
    it("should fetch user settings successfully", async () => {
      // Arrange
      const mockUserSettings: UserSettings = {
        did: "user123",
        pdsSyncEnabled: 1,
        createdAt: "2025-06-07T12:00:00.000Z",
      };
      mockSelectBuilder.executeTakeFirst = async () => mockUserSettings;

      // Act
      const result = await settingsService.getUserSettings("user123");

      // Assert
      assert.deepStrictEqual(result, mockUserSettings);
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 1);
      assert.deepStrictEqual(mockDb.selectFrom.mock.calls[0].arguments, [
        "user_settings",
      ]);
    });

    it("should throw an error when the database query fails", async () => {
      // Arrange
      const testError = new Error("Database connection failed");
      mockSelectBuilder.executeTakeFirst = async () => {
        throw testError;
      };

      // Act & Assert
      await assert.rejects(
        async () => await settingsService.getUserSettings("user123"),
        { message: "Failed to fetch user settings" }
      );

      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });
  });

  describe("createDefaultSettings", () => {
    it("should create default settings successfully", async () => {
      // Arrange
      mockInsertBuilder.execute = async () => ({});
      const beforeDate = new Date().toISOString();

      // Act
      const result = await settingsService.createDefaultSettings("user123");

      const afterDate = new Date().toISOString();

      // Assert
      assert.strictEqual(result.did, "user123");
      assert.strictEqual(result.pdsSyncEnabled, 1);
      assert.ok(
        result.createdAt >= beforeDate && result.createdAt <= afterDate,
        `createdAt (${result.createdAt}) should be between ${beforeDate} and ${afterDate}`
      );
      assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
      assert.deepStrictEqual(mockDb.insertInto.mock.calls[0].arguments, [
        "user_settings",
      ]);
      assert.strictEqual(lastValuesArg.did, "user123");
      assert.strictEqual(lastValuesArg.pdsSyncEnabled, 1);
    });

    it("should throw an error when the database insert fails", async () => {
      // Arrange
      const testError = new Error("Database insert failed");
      mockInsertBuilder.execute = async () => {
        throw testError;
      };

      // Act & Assert
      await assert.rejects(
        async () => await settingsService.createDefaultSettings("user123"),
        (err: any) => {
          assert.strictEqual(
            err.message,
            "Failed to create default user settings"
          );
          return true;
        }
      );

      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });
  });

  describe("updateSettings", () => {
    it("should create new settings when they do not exist", async () => {
      // Arrange
      executeTakeFirstQueue.push(undefined);
      executeTakeFirstQueue.push({
        did: "user123",
        pdsSyncEnabled: 1,
        createdAt: "2025-06-07T12:00:00.000Z",
      });
      (mockInsertBuilder.execute as any) = async () => ({});

      // Act
      const result = await settingsService.updateSettings("user123", true);

      // Assert
      assert.deepStrictEqual(result, {
        did: "user123",
        pdsSyncEnabled: 1,
        createdAt: "2025-06-07T12:00:00.000Z",
      });
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 2);
      assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
      assert.strictEqual(mockDb.updateTable.mock.calls.length, 0);
    });

    it("should update existing settings", async () => {
      // Arrange
      executeTakeFirstQueue.push({
        did: "user123",
        pdsSyncEnabled: 1,
        createdAt: "2025-06-07T12:00:00.000Z",
      });
      executeTakeFirstQueue.push({
        did: "user123",
        pdsSyncEnabled: 0,
        createdAt: "2025-06-07T12:00:00.000Z",
      });
      (mockUpdateBuilder.execute as any) = async () => ({});

      // Act
      const result = await settingsService.updateSettings("user123", false);

      // Assert
      assert.deepStrictEqual(result, {
        did: "user123",
        pdsSyncEnabled: 0,
        createdAt: "2025-06-07T12:00:00.000Z",
      });
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 2);
      assert.strictEqual(mockDb.insertInto.mock.calls.length, 0);
      assert.strictEqual(mockDb.updateTable.mock.calls.length, 1);
    });

    it("should throw an error when the database operations fail", async () => {
      // Arrange
      mockSelectBuilder.executeTakeFirst = async () => {
        throw new Error("Database operation failed");
      };

      // Act & Assert
      await assert.rejects(
        async () => await settingsService.updateSettings("user123", true),
        { message: "Failed to update user settings" }
      );

      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 1);
      assert.strictEqual(mockLogger.error.mock.calls.length, 2);
    });
  });
});
