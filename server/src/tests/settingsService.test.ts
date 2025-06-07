import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { SettingsService, UserSettings } from "../services/settingsService";
import {
  SelectQueryBuilder,
  InsertQueryBuilder,
  UpdateQueryBuilder,
  Kysely,
} from "kysely";

// Define a minimal Kysely DB type for mocks
interface MockDB {
  user_settings: UserSettings;
}

describe("SettingsService", () => {
  const mockLogger = {
    error: mock.fn(),
    info: mock.fn(),
    debug: mock.fn(),
  };

  // Mock Kysely query builders with appropriate types
  const mockSelectBuilder = {
    selectAll: mock.fn<
      [],
      SelectQueryBuilder<MockDB, "user_settings", UserSettings>
    >(),
    where: mock.fn<
      [any, any, any],
      SelectQueryBuilder<MockDB, "user_settings", UserSettings>
    >(),
    executeTakeFirst: mock.fn<[], Promise<UserSettings | undefined>>(),
  };

  const mockInsertBuilder = {
    values: mock.fn<
      [UserSettings],
      InsertQueryBuilder<MockDB, "user_settings", UserSettings>
    >(),
    execute: mock.fn<[], Promise<any>>(), // Kysely's execute for insert returns an InsertResult
  };

  const mockUpdateBuilder = {
    set: mock.fn<
      [Partial<UserSettings>],
      UpdateQueryBuilder<MockDB, "user_settings", "user_settings", UserSettings>
    >(),
    where: mock.fn<
      [any, any, any],
      UpdateQueryBuilder<MockDB, "user_settings", "user_settings", UserSettings>
    >(),
    execute: mock.fn<[], Promise<any>>(), // Kysely's execute for update returns an UpdateResult
  };

  const mockDb = {
    selectFrom: mock.fn<
      [keyof MockDB],
      SelectQueryBuilder<MockDB, "user_settings", UserSettings>
    >(),
    insertInto: mock.fn<
      [keyof MockDB],
      InsertQueryBuilder<MockDB, "user_settings", UserSettings>
    >(),
    updateTable: mock.fn<
      [keyof MockDB],
      UpdateQueryBuilder<MockDB, "user_settings", "user_settings", UserSettings>
    >(),
  };

  let settingsService: SettingsService;

  beforeEach(() => {
    mockLogger.error.mock.resetCalls();
    mockLogger.info.mock.resetCalls();
    mockLogger.debug.mock.resetCalls();

    mockDb.selectFrom.mock.resetCalls();
    mockDb.insertInto.mock.resetCalls();
    mockDb.updateTable.mock.resetCalls();

    mockSelectBuilder.selectAll.mock.resetCalls();
    mockSelectBuilder.where.mock.resetCalls();
    mockSelectBuilder.executeTakeFirst.mock.resetCalls();

    mockInsertBuilder.values.mock.resetCalls();
    mockInsertBuilder.execute.mock.resetCalls();

    mockUpdateBuilder.set.mock.resetCalls();
    mockUpdateBuilder.where.mock.resetCalls();
    mockUpdateBuilder.execute.mock.resetCalls();

    mockDb.selectFrom.mock.mockImplementation(() => mockSelectBuilder as any);
    mockSelectBuilder.selectAll.mock.mockImplementation(
      () => mockSelectBuilder as any
    );
    mockSelectBuilder.where.mock.mockImplementation(
      () => mockSelectBuilder as any
    );

    mockDb.insertInto.mock.mockImplementation(() => mockInsertBuilder as any);
    mockInsertBuilder.values.mock.mockImplementation(
      () => mockInsertBuilder as any
    );

    mockDb.updateTable.mock.mockImplementation(() => mockUpdateBuilder as any);
    mockUpdateBuilder.set.mock.mockImplementation(
      () => mockUpdateBuilder as any
    );
    mockUpdateBuilder.where.mock.mockImplementation(
      () => mockUpdateBuilder as any
    );

    settingsService = new SettingsService(
      mockDb as unknown as Kysely<MockDB>,
      mockLogger as any
    );
  });

  describe("getUserSettings", () => {
    it("should fetch user settings successfully", async () => {
      // Arrange
      const mockUserSettings: UserSettings = {
        did: "user123",
        pdsSyncEnabled: 1,
        createdAt: "2025-06-07T12:00:00.000Z",
      };
      mockSelectBuilder.executeTakeFirst.mock.mockImplementation(
        async () => mockUserSettings
      );

      // Act
      const result = await settingsService.getUserSettings("user123");

      // Assert
      assert.deepStrictEqual(result, mockUserSettings);
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 1);
      assert.strictEqual(mockSelectBuilder.selectAll.mock.calls.length, 1);
      assert.strictEqual(mockSelectBuilder.where.mock.calls.length, 1);
      assert.strictEqual(
        mockSelectBuilder.executeTakeFirst.mock.calls.length,
        1
      );
      assert.deepStrictEqual(mockDb.selectFrom.mock.calls[0].arguments, [
        "user_settings",
      ]);
      assert.deepStrictEqual(mockSelectBuilder.where.mock.calls[0].arguments, [
        "did",
        "=",
        "user123",
      ]);
    });

    it("should throw an error when the database query fails", async () => {
      // Arrange
      const testError = new Error("Database connection failed");
      mockSelectBuilder.executeTakeFirst.mock.mockImplementation(async () => {
        throw testError;
      });

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
      mockInsertBuilder.execute.mock.mockImplementation(
        async () => ({ numInsertedOrUpdatedRows: BigInt(1) }) as any
      ); // Mock Kysely InsertResult

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
      assert.strictEqual(mockInsertBuilder.values.mock.calls.length, 1);
      assert.strictEqual(mockInsertBuilder.execute.mock.calls.length, 1);

      assert.deepStrictEqual(mockDb.insertInto.mock.calls[0].arguments, [
        "user_settings",
      ]);

      const valuesArg = mockInsertBuilder.values.mock.calls[0].arguments[0];
      assert.strictEqual(valuesArg.did, "user123");
      assert.strictEqual(valuesArg.pdsSyncEnabled, 1);
    });

    it("should throw an error when the database insert fails", async () => {
      // Arrange
      const testError = new Error("Database insert failed");
      mockInsertBuilder.execute.mock.mockImplementation(async () => {
        throw testError;
      });

      // Act & Assert
      await assert.rejects(
        async () => await settingsService.createDefaultSettings("user123"),
        { message: "Failed to create default user settings" }
      );

      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });
  });

  describe("updateSettings", () => {
    it("should create new settings when they do not exist", async () => {
      // Arrange
      mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
        async () => undefined
      );

      const mockNewSettings: UserSettings = {
        did: "user123",
        pdsSyncEnabled: 1,
        createdAt: "2025-06-07T12:00:00.000Z",
      };
      mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
        async () => mockNewSettings
      );

      mockInsertBuilder.execute.mock.mockImplementation(
        async () => ({ numInsertedOrUpdatedRows: BigInt(1) }) as any
      );

      // Act
      const result = await settingsService.updateSettings("user123", true);

      // Assert
      assert.deepStrictEqual(result, mockNewSettings);

      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 2);
      assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
      assert.strictEqual(mockDb.updateTable.mock.calls.length, 0);

      assert.strictEqual(mockInsertBuilder.values.mock.calls.length, 1);
      assert.strictEqual(mockInsertBuilder.execute.mock.calls.length, 1);

      const valuesArg = mockInsertBuilder.values.mock.calls[0].arguments[0];
      assert.strictEqual(valuesArg.did, "user123");
      assert.strictEqual(valuesArg.pdsSyncEnabled, 1);
    });

    it("should update existing settings", async () => {
      // Arrange
      const mockExistingSettings: UserSettings = {
        did: "user123",
        pdsSyncEnabled: 1,
        createdAt: "2025-06-07T12:00:00.000Z",
      };
      mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
        async () => mockExistingSettings
      );
      const mockUpdatedSettings: UserSettings = {
        did: "user123",
        pdsSyncEnabled: 0,
        createdAt: "2025-06-07T12:00:00.000Z",
      };
      mockSelectBuilder.executeTakeFirst.mock.mockImplementationOnce(
        async () => mockUpdatedSettings
      );

      mockUpdateBuilder.execute.mock.mockImplementation(
        async () => ({ numUpdatedRows: BigInt(1) }) as any
      ); // Mock Kysely UpdateResult

      // Act
      const result = await settingsService.updateSettings("user123", false);

      // Assert
      assert.deepStrictEqual(result, mockUpdatedSettings);

      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 2);
      assert.strictEqual(mockDb.insertInto.mock.calls.length, 0);
      assert.strictEqual(mockDb.updateTable.mock.calls.length, 1);

      assert.strictEqual(mockUpdateBuilder.set.mock.calls.length, 1);
      assert.strictEqual(mockUpdateBuilder.where.mock.calls.length, 1);
      assert.strictEqual(mockUpdateBuilder.execute.mock.calls.length, 1);
      assert.deepStrictEqual(mockUpdateBuilder.set.mock.calls[0].arguments, [
        { pdsSyncEnabled: 0 },
      ]);
      assert.deepStrictEqual(mockUpdateBuilder.where.mock.calls[0].arguments, [
        "did",
        "=",
        "user123",
      ]);
    });

    it("should throw an error when the database operations fail", async () => {
      // Arrange
      const testError = new Error("Database operation failed");
      mockSelectBuilder.executeTakeFirst.mock.mockImplementation(async () => {
        throw testError;
      });

      // Act & Assert
      await assert.rejects(
        async () => await settingsService.updateSettings("user123", true),
        { message: "Failed to update user settings" }
      );

      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });
  });
});
