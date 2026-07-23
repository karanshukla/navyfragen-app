import assert from "node:assert";
import { describe, it, beforeEach, mock } from "node:test";

import { SettingsService, UserSettings } from "../services/settings-service";

interface MockDB {
  user_settings: UserSettings;
}

describe("SettingsService", () => {
  const mockLogger = {
    error: mock.fn(),
    info: mock.fn(),
    debug: mock.fn(),
    warn: mock.fn(),
  };

  const mockSelectBuilder = {
    selectAll() {
      return this;
    },
    select(fnOrFields?: any) {
      if (typeof fnOrFields === "function") {
        fnOrFields({ fn: { countAll: () => ({ as: () => ({}) }) } });
      }
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

  let lastSetArg: any;
  const mockUpdateBuilder = {
    set(arg: any) {
      lastSetArg = arg;
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
    mockLogger.warn.mock.resetCalls();

    mockDb.selectFrom.mock.resetCalls();
    mockDb.insertInto.mock.resetCalls();
    mockDb.updateTable.mock.resetCalls();

    executeTakeFirstQueue = [];
    mockSelectBuilder.executeTakeFirst = async () => executeTakeFirstQueue.shift();
    lastValuesArg = undefined;
    lastSetArg = undefined;

    settingsService = new SettingsService(mockDb as any, mockLogger as any);
  });

  describe("getUserSettings", () => {
    it("should fetch user settings successfully", async () => {
      // Arrange
      const mockUserSettings: UserSettings = {
        did: "user123",
        pdsSyncEnabled: 1,
        imageTheme: "default",
        inboxEnabled: 1,
        profanityFilterEnabled: 0,
        customPrompt: null,
        profileCardTheme: null,
        touchpointLocale: null,
        createdAt: "2025-06-07T12:00:00.000Z",
      };
      mockSelectBuilder.executeTakeFirst = async () => mockUserSettings;

      // Act
      const result = await settingsService.getUserSettings("user123");

      // Assert
      assert.deepStrictEqual(result, mockUserSettings);
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 1);
      assert.deepStrictEqual(mockDb.selectFrom.mock.calls[0].arguments, ["user_settings"]);
    });

    it("should throw an error when the database query fails", async () => {
      // Arrange
      const testError = new Error("Database connection failed");
      mockSelectBuilder.executeTakeFirst = async () => {
        throw testError;
      };

      // Act & Assert
      await assert.rejects(async () => await settingsService.getUserSettings("user123"), {
        message: "Failed to fetch user settings",
      });

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
      assert.strictEqual(result.inboxEnabled, 1);
      assert.strictEqual(result.customPrompt, null);
      assert.strictEqual(result.profileCardTheme, null);
      assert.strictEqual(result.touchpointLocale, null);
      assert.ok(
        result.createdAt >= beforeDate && result.createdAt <= afterDate,
        `createdAt (${result.createdAt}) should be between ${beforeDate} and ${afterDate}`
      );
      assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
      assert.deepStrictEqual(mockDb.insertInto.mock.calls[0].arguments, ["user_settings"]);
      assert.strictEqual(lastValuesArg.did, "user123");
      assert.strictEqual(lastValuesArg.pdsSyncEnabled, 1);
      assert.strictEqual(lastValuesArg.inboxEnabled, 1);
      assert.strictEqual(lastValuesArg.customPrompt, null);
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
          assert.strictEqual(err.message, "Failed to create default user settings");
          return true;
        }
      );

      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });
  });

  describe("updateSettings", () => {
    it("should create new settings with defaults when they do not exist", async () => {
      // Arrange
      executeTakeFirstQueue.push(undefined);
      executeTakeFirstQueue.push({
        did: "user123",
        pdsSyncEnabled: 1,
        imageTheme: "default",
        inboxEnabled: 1,
        profanityFilterEnabled: 0,
        customPrompt: null,
        profileCardTheme: null,
        touchpointLocale: null,
        createdAt: "2025-06-07T12:00:00.000Z",
      });
      (mockInsertBuilder.execute as any) = async () => ({});

      // Act
      const result = await settingsService.updateSettings("user123", {
        pdsSyncEnabled: true,
        imageTheme: "default",
      });

      // Assert
      assert.deepStrictEqual(result, {
        did: "user123",
        pdsSyncEnabled: 1,
        imageTheme: "default",
        inboxEnabled: 1,
        profanityFilterEnabled: 0,
        customPrompt: null,
        profileCardTheme: null,
        touchpointLocale: null,
        createdAt: "2025-06-07T12:00:00.000Z",
      });
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 2);
      assert.strictEqual(mockDb.insertInto.mock.calls.length, 1);
      assert.strictEqual(mockDb.updateTable.mock.calls.length, 0);
      assert.strictEqual(lastValuesArg.pdsSyncEnabled, 1);
      assert.strictEqual(lastValuesArg.imageTheme, "default");
      // inboxEnabled defaults to 1 (open) on insert even when not provided.
      assert.strictEqual(lastValuesArg.inboxEnabled, 1);
      assert.strictEqual(lastValuesArg.customPrompt, null);
    });

    it("should update only the provided fields on an existing row (partial update)", async () => {
      // Arrange
      executeTakeFirstQueue.push({
        did: "user123",
        pdsSyncEnabled: 1,
        imageTheme: "default",
        inboxEnabled: 1,
        profanityFilterEnabled: 0,
        customPrompt: null,
        profileCardTheme: null,
        touchpointLocale: null,
        createdAt: "2025-06-07T12:00:00.000Z",
      });
      executeTakeFirstQueue.push({
        did: "user123",
        pdsSyncEnabled: 1,
        imageTheme: "default",
        inboxEnabled: 1,
        profanityFilterEnabled: 0,
        customPrompt: null,
        profileCardTheme: null,
        touchpointLocale: null,
        createdAt: "2025-06-07T12:00:00.000Z",
      });
      (mockUpdateBuilder.execute as any) = async () => ({});

      // Act — a Customise card mutating ONLY inboxEnabled must not touch the
      // other fields (pdsSyncEnabled, imageTheme, etc.).
      const result = await settingsService.updateSettings("user123", { inboxEnabled: false });

      // Assert
      assert.strictEqual(result!.inboxEnabled, 1); // mock returns the queue's row, unchanged
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 2);
      assert.strictEqual(mockDb.insertInto.mock.calls.length, 0);
      assert.strictEqual(mockDb.updateTable.mock.calls.length, 1);
      // Only inboxEnabled is in the SET payload — the partial signature must
      // not clobber the other columns to defaults.
      assert.deepStrictEqual(Object.keys(lastSetArg), ["inboxEnabled"]);
      assert.strictEqual(lastSetArg.inboxEnabled, 0); // false → 0 for SQLite
    });

    it("should persist each individual /customise field when provided", async () => {
      // Arrange
      const baseRow = {
        did: "user123",
        pdsSyncEnabled: 1,
        imageTheme: "default",
        inboxEnabled: 1,
        profanityFilterEnabled: 0,
        customPrompt: null,
        profileCardTheme: null,
        touchpointLocale: null,
        createdAt: "2025-06-07T12:00:00.000Z",
      };
      executeTakeFirstQueue.push({ ...baseRow });
      executeTakeFirstQueue.push({ ...baseRow });
      (mockUpdateBuilder.execute as any) = async () => ({});

      // Act — every Customise field at once (#199/#177/#275/#266/#58).
      await settingsService.updateSettings("user123", {
        customPrompt: "Ask me anything",
        profileCardTheme: "ember",
        touchpointLocale: "es",
        imageTheme: "twitter",
        pdsSyncEnabled: false,
        profanityFilterEnabled: true,
      });

      // Assert — all six provided fields land in the SET payload, booleans
      // converted to 1/0, nullables passed through as-is. Unprovided fields
      // (inboxEnabled) are absent — the partial update never sets them.
      assert.deepStrictEqual(lastSetArg, {
        pdsSyncEnabled: 0,
        imageTheme: "twitter",
        profanityFilterEnabled: 1,
        customPrompt: "Ask me anything",
        profileCardTheme: "ember",
        touchpointLocale: "es",
      });
    });

    it("should persist a null customPrompt to unset it", async () => {
      // Arrange
      const baseRow = {
        did: "user123",
        pdsSyncEnabled: 1,
        imageTheme: "default",
        inboxEnabled: 1,
        customPrompt: "previously set",
        profileCardTheme: null,
        touchpointLocale: null,
        createdAt: "2025-06-07T12:00:00.000Z",
      };
      executeTakeFirstQueue.push({ ...baseRow });
      executeTakeFirstQueue.push({ ...baseRow });
      (mockUpdateBuilder.execute as any) = async () => ({});

      // Act
      await settingsService.updateSettings("user123", { customPrompt: null });

      // Assert — null is a valid value (means "use the default"), not "skip".
      assert.deepStrictEqual(Object.keys(lastSetArg), ["customPrompt"]);
      assert.strictEqual(lastSetArg.customPrompt, null);
    });

    it("should throw an error when the database operations fail", async () => {
      // Arrange
      mockSelectBuilder.executeTakeFirst = async () => {
        throw new Error("Database operation failed");
      };

      // Act & Assert
      await assert.rejects(
        async () => await settingsService.updateSettings("user123", { pdsSyncEnabled: true }),
        { message: "Failed to update user settings" }
      );

      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 1);
      assert.strictEqual(mockLogger.error.mock.calls.length, 2);
    });
  });

  describe("getPdsInfo", () => {
    function makeAgent(records: any[], cursor?: string, successOverride: boolean = true) {
      return {
        com: {
          atproto: {
            repo: {
              listRecords: mock.fn(async () => ({
                success: successOverride,
                data: { records, cursor },
              })),
            },
          },
        },
      };
    }

    function makeIdResolver(pds: string | null, throws?: boolean) {
      return {
        did: {
          resolveAtprotoData: mock.fn(async () => {
            if (throws) throw new Error("resolve failed");
            return { pds };
          }),
        },
      };
    }

    it("should return pdsUrl and recordCount when resolved successfully", async () => {
      const agent = makeAgent([{ cid: "c1" }, { cid: "c2" }]);
      const idResolver = makeIdResolver("https://pds.example.com");

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(result.pdsUrl, "https://pds.example.com");
      assert.strictEqual(result.recordCount, 2);
    });

    it("should return pdsUrl null when idResolver throws", async () => {
      const agent = makeAgent([]);
      const idResolver = makeIdResolver(null, true);

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(result.pdsUrl, null);
      assert.strictEqual(result.recordCount, 0);
    });

    it("should return pdsUrl null when atprotoData has null pds", async () => {
      const agent = makeAgent([]);
      const idResolver = {
        did: {
          resolveAtprotoData: mock.fn(async () => ({ pds: null })),
        },
      };

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(result.pdsUrl, null);
      assert.strictEqual(result.recordCount, 0);
    });

    it("should return pdsUrl null when atprotoData has undefined pds", async () => {
      const agent = makeAgent([]);
      const idResolver = {
        did: {
          resolveAtprotoData: mock.fn(async () => ({})),
        },
      };

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(result.pdsUrl, null);
      assert.strictEqual(result.recordCount, 0);
    });

    it("should return recordCount 0 when listRecords returns success: false", async () => {
      const agent = makeAgent([], undefined, false);
      const idResolver = makeIdResolver("https://pds.example.com");

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(result.pdsUrl, "https://pds.example.com");
      assert.strictEqual(result.recordCount, 0);
    });

    it("should handle recordCount 0 when listRecords throws", async () => {
      const agent = {
        com: {
          atproto: {
            repo: {
              listRecords: mock.fn(async () => {
                throw new Error("list failed");
              }),
            },
          },
        },
      };
      const idResolver = makeIdResolver("https://pds.example.com");

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(result.pdsUrl, "https://pds.example.com");
      assert.strictEqual(result.recordCount, 0);
    });

    it("should paginate through multiple pages of records", async () => {
      let callCount = 0;
      const agent = {
        com: {
          atproto: {
            repo: {
              listRecords: mock.fn(async () => {
                callCount++;
                if (callCount === 1) {
                  return {
                    success: true,
                    data: { records: [{ cid: "c1" }, { cid: "c2" }], cursor: "page2" },
                  };
                }
                return {
                  success: true,
                  data: { records: [{ cid: "c3" }], cursor: undefined },
                };
              }),
            },
          },
        },
      };
      const idResolver = makeIdResolver("https://pds.example.com");

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(result.recordCount, 3);
      assert.strictEqual(callCount, 2);
    });

    it("should return null pdsUrl when idResolver returns null pds (non-throwing)", async () => {
      const agent = makeAgent([]);
      const idResolver = makeIdResolver(null, false);

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(result.pdsUrl, null);
      assert.strictEqual(result.recordCount, 0);
    });

    it("should return null pdsUrl when resolveAtprotoData returns null (optional chain short-circuits)", async () => {
      const agent = makeAgent([]);
      const idResolver = {
        did: {
          resolveAtprotoData: mock.fn(async () => null),
        },
      };

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(result.pdsUrl, null);
      assert.strictEqual(result.recordCount, 0);
    });

    it("should stop fetching after 10 pages (max page limit)", async () => {
      let callCount = 0;
      const agent = {
        com: {
          atproto: {
            repo: {
              listRecords: mock.fn(async () => {
                callCount++;
                return {
                  success: true,
                  data: { records: [{ cid: `c${callCount}` }], cursor: `page${callCount + 1}` },
                };
              }),
            },
          },
        },
      };
      const idResolver = makeIdResolver("https://pds.example.com");

      const result = await settingsService.getPdsInfo("user123", agent as any, idResolver as any);

      assert.strictEqual(callCount, 10);
      assert.strictEqual(result.recordCount, 10);
    });
  });

  describe("getStats", () => {
    it("should return message count and member since date", async () => {
      executeTakeFirstQueue.push({ count: 42 } as any);
      executeTakeFirstQueue.push({ createdAt: "2025-01-01T00:00:00.000Z" } as any);

      const result = await settingsService.getStats("user123");

      assert.strictEqual(result.messageCount, 42);
      assert.strictEqual(result.memberSince, "2025-01-01T00:00:00.000Z");
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 2);
    });

    it("should return 0 message count when there are no messages", async () => {
      executeTakeFirstQueue.push(undefined); // no count row
      executeTakeFirstQueue.push({ createdAt: "2025-01-01T00:00:00.000Z" } as any);

      const result = await settingsService.getStats("user123");

      assert.strictEqual(result.messageCount, 0);
      assert.strictEqual(result.memberSince, "2025-01-01T00:00:00.000Z");
    });

    it("should return null memberSince when user is not in user_profile", async () => {
      executeTakeFirstQueue.push({ count: 5 } as any);
      executeTakeFirstQueue.push(undefined); // no profile row

      const result = await settingsService.getStats("user123");

      assert.strictEqual(result.messageCount, 5);
      assert.strictEqual(result.memberSince, null);
    });

    it("should throw when the database query fails", async () => {
      mockSelectBuilder.executeTakeFirst = async () => {
        throw new Error("Database query failed");
      };

      await assert.rejects(async () => await settingsService.getStats("user123"), {
        message: "Failed to fetch user stats",
      });
      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });
  });
});
