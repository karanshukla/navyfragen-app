import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { ProfileService, ProfileResolver } from "../services/profile-service";
import { Kysely } from "kysely";

describe("ProfileService", () => {
  // Mock Logger
  const mockLogger = {
    error: mock.fn(),
    warn: mock.fn(),
    info: mock.fn(),
    debug: mock.fn(),
  };

  // Mock database query builders
  const mockSelectBuilder = {
    select() {
      return this;
    },
    where() {
      return this;
    },
    executeTakeFirst: async () => undefined,
  };

  const mockDb = {
    selectFrom: mock.fn(() => mockSelectBuilder),
  };

  // Mock AtpAgent response
  const mockGetProfile = mock.fn(async () => ({
    success: true,
    data: {
      did: "did:test:user123",
      handle: "test.bsky.app",
      displayName: "Test User",
    },
  }));

  // Mock the AtpAgent
  const mockAtpAgent = {
    getProfile: mockGetProfile,
  };

  // Mock ProfileResolver
  const mockResolver = {
    resolveDidToHandle: mock.fn(async (did) => `handle-for-${did}`),
    resolveHandleToDid: mock.fn(async (handle) =>
      handle === "not-found" ? undefined : `did-for-${handle}`
    ),
  };

  let profileService: ProfileService;

  beforeEach(() => {
    // Reset all mocks
    mockLogger.error.mock.resetCalls();
    mockLogger.warn.mock.resetCalls();
    mockLogger.info.mock.resetCalls();
    mockLogger.debug.mock.resetCalls();

    mockDb.selectFrom.mock.resetCalls();
    mockGetProfile.mock.resetCalls();
    mockResolver.resolveDidToHandle.mock.resetCalls();
    mockResolver.resolveHandleToDid.mock.resetCalls();

    // Create a new instance of the service with our mocks
    profileService = new ProfileService(
      mockDb as unknown as Kysely<any>,
      mockResolver as ProfileResolver,
      mockLogger as any
    );

    // Override the AtpAgent with our mock
    (profileService as any).agent = mockAtpAgent;
  });

  describe("getPublicProfile", () => {
    it("should fetch public profile successfully", async () => {
      // Arrange
      const testDid = "did:test:user123";
      const expectedHandle = "handle-for-did:test:user123";

      // Act
      const result = await profileService.getPublicProfile(testDid);

      // Assert
      assert.strictEqual(result.did, testDid);
      assert.strictEqual(result.handle, expectedHandle);
      assert.deepStrictEqual(result.profile, {
        did: testDid,
        handle: "test.bsky.app",
        displayName: "Test User",
      });
      assert.strictEqual(mockGetProfile.mock.calls.length, 1);
      assert.deepStrictEqual(mockGetProfile.mock.calls[0].arguments, [
        { actor: testDid },
      ]);
      assert.strictEqual(mockResolver.resolveDidToHandle.mock.calls.length, 1);
    });

    it("should use DID as fallback when handle resolution fails", async () => {
      // Arrange
      const testDid = "did:test:user456";
      mockResolver.resolveDidToHandle = mock.fn(async () => {
        throw new Error("Handle resolution failed");
      });

      // Act
      const result = await profileService.getPublicProfile(testDid);

      // Assert
      assert.strictEqual(result.did, testDid);
      assert.strictEqual(result.handle, testDid); // DID used as fallback
      assert.strictEqual(mockLogger.warn.mock.calls.length, 1);
    });
    it("should throw an error when profile is not found", async () => {
      // Arrange
      const testDid = "did:test:notfound";
      // Create a new mock implementation for this test
      const tempMockGetProfile = mock.fn(async () => ({
        success: false,
      }));
      // Replace the original mock
      (profileService as any).agent.getProfile = tempMockGetProfile;

      // Act & Assert
      await assert.rejects(
        async () => await profileService.getPublicProfile(testDid),
        { message: "Failed to fetch profile" }
      );
      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });

    it("should throw an error when the API call fails", async () => {
      // Arrange
      const testDid = "did:test:error";
      // Create a new mock implementation for this test
      const tempMockGetProfile = mock.fn(async () => {
        throw new Error("API call failed");
      });
      // Replace the original mock
      (profileService as any).agent.getProfile = tempMockGetProfile;

      // Act & Assert
      await assert.rejects(
        async () => await profileService.getPublicProfile(testDid),
        { message: "Failed to fetch profile" }
      );
      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });
  });

  describe("checkUserExists", () => {
    it("should return true when user exists", async () => {
      // Arrange
      const testDid = "did:test:existing";
      mockSelectBuilder.executeTakeFirst = async () => ({ did: testDid });

      // Act
      const result = await profileService.checkUserExists(testDid);

      // Assert
      assert.strictEqual(result, true);
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 1);
      assert.deepStrictEqual(mockDb.selectFrom.mock.calls[0].arguments, [
        "user_profile",
      ]);
    });

    it("should return false when user does not exist", async () => {
      // Arrange
      const testDid = "did:test:nonexistent";
      mockSelectBuilder.executeTakeFirst = async () => undefined;

      // Act
      const result = await profileService.checkUserExists(testDid);

      // Assert
      assert.strictEqual(result, false);
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 1);
    });

    it("should throw an error when the database query fails", async () => {
      // Arrange
      const testDid = "did:test:error";
      mockSelectBuilder.executeTakeFirst = async () => {
        throw new Error("Database operation failed");
      };

      // Act & Assert
      await assert.rejects(
        async () => await profileService.checkUserExists(testDid),
        { message: "Failed to check user existence" }
      );
      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });
  });

  describe("resolveHandleToDid", () => {
    it("should resolve handle to DID successfully", async () => {
      // Arrange
      const testHandle = "test.bsky.app";
      const expectedDid = "did-for-test.bsky.app";

      // Act
      const result = await profileService.resolveHandleToDid(testHandle);

      // Assert
      assert.strictEqual(result, expectedDid);
      assert.strictEqual(mockResolver.resolveHandleToDid.mock.calls.length, 1);
      assert.deepStrictEqual(
        mockResolver.resolveHandleToDid.mock.calls[0].arguments,
        [testHandle]
      );
    });

    it("should throw an error when handle is not found", async () => {
      // Arrange
      const testHandle = "not-found";

      // Act & Assert
      await assert.rejects(
        async () => await profileService.resolveHandleToDid(testHandle),
        { message: "Failed to resolve handle" }
      );
      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });

    it("should throw an error when resolver fails", async () => {
      // Arrange
      const testHandle = "error.bsky.app";
      mockResolver.resolveHandleToDid = mock.fn(async () => {
        throw new Error("Resolver operation failed");
      });

      // Act & Assert
      await assert.rejects(
        async () => await profileService.resolveHandleToDid(testHandle),
        { message: "Failed to resolve handle" }
      );
      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });
  });
});
