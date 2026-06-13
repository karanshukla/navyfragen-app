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
    executeTakeFirst: async () => undefined as any, // Will be overridden in tests
    execute: async () => [] as any[], // Will be overridden in tests that need it
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
    it("should fetch public profile and return exists: false when user not in DB", async () => {
      // Arrange
      const testDid = "did:test:user123";
      mockSelectBuilder.executeTakeFirst = async () => undefined;

      // Act
      const result = await profileService.getPublicProfile(testDid);

      // Assert
      assert.strictEqual(result.exists, false);
      assert.deepStrictEqual(result.profile, {
        did: testDid,
        handle: "test.bsky.app",
        displayName: "Test User",
      });
      assert.strictEqual(mockGetProfile.mock.calls.length, 1);
      assert.deepStrictEqual(mockGetProfile.mock.calls[0].arguments, [
        { actor: testDid },
      ]);
      assert.strictEqual(mockResolver.resolveDidToHandle.mock.calls.length, 0);
    });

    it("should return exists: true when user is registered in DB", async () => {
      // Arrange
      const testDid = "did:test:user456";
      mockSelectBuilder.executeTakeFirst = async () => ({ did: testDid });

      // Act
      const result = await profileService.getPublicProfile(testDid);

      // Assert
      assert.strictEqual(result.exists, true);
      assert.ok(result.profile);
    });

    it("should throw 'Profile not found' when Bluesky returns success: false", async () => {
      // Arrange
      const testDid = "did:test:notfound";
      const tempMockGetProfile = mock.fn(async () => ({ success: false }));
      (profileService as any).agent.getProfile = tempMockGetProfile;

      // Act & Assert
      await assert.rejects(
        async () => await profileService.getPublicProfile(testDid),
        { message: "Profile not found" }
      );
    });

    it("should throw an error when the API call fails", async () => {
      // Arrange
      const testDid = "did:test:error";
      const tempMockGetProfile = mock.fn(async () => {
        throw new Error("API call failed");
      });
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

    it("should throw 'Handle not found' when resolver returns undefined", async () => {
      // Arrange
      const testHandle = "not-found"; // resolver mock returns undefined for this

      // Act & Assert
      await assert.rejects(
        async () => await profileService.resolveHandleToDid(testHandle),
        { message: "Handle not found" }
      );
      // No error log — this is an expected 404, not an unexpected failure
      assert.strictEqual(mockLogger.error.mock.calls.length, 0);
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

  describe("checkFollowsBot", () => {
    it("should return true when agent is following the bot", async () => {
      const mockAgent = {
        getProfile: mock.fn(async () => ({
          success: true,
          data: { viewer: { following: "at://did:bot/app.bsky.graph.follow/rkey" } },
        })),
      };

      const result = await profileService.checkFollowsBot(mockAgent as any, "did:bot:123");

      assert.strictEqual(result, true);
    });

    it("should return false when agent is not following the bot", async () => {
      const mockAgent = {
        getProfile: mock.fn(async () => ({
          success: true,
          data: { viewer: { following: undefined } },
        })),
      };

      const result = await profileService.checkFollowsBot(mockAgent as any, "did:bot:123");

      assert.strictEqual(result, false);
    });

    it("should return false when getProfile returns success: false", async () => {
      const mockAgent = {
        getProfile: mock.fn(async () => ({ success: false, data: {} })),
      };

      const result = await profileService.checkFollowsBot(mockAgent as any, "did:bot:123");

      assert.strictEqual(result, false);
    });

    it("should return false and log error when getProfile throws", async () => {
      const mockAgent = {
        getProfile: mock.fn(async () => { throw new Error("network error"); }),
      };

      const result = await profileService.checkFollowsBot(mockAgent as any, "did:bot:123");

      assert.strictEqual(result, false);
      assert.strictEqual(mockLogger.error.mock.calls.length, 1);
    });

    it("should return false when viewer is undefined in profile response", async () => {
      const mockAgent = {
        getProfile: mock.fn(async () => ({
          success: true,
          data: { viewer: undefined },
        })),
      };

      const result = await profileService.checkFollowsBot(mockAgent as any, "did:bot:123");

      assert.strictEqual(result, false);
    });
  });

  describe("getFriendsOnApp", () => {
    const sampleFollows = [
      { did: "did:user:1", handle: "user1.bsky.app", displayName: "User One", avatar: "https://cdn.test/1.jpg" },
      { did: "did:user:2", handle: "user2.bsky.app", displayName: "User Two", avatar: undefined },
      { did: "did:user:3", handle: "user3.bsky.app", displayName: undefined, avatar: undefined },
    ];

    // authenticated agent — only needs getFollows (getFollowers uses the public agent)
    const makeAuthAgent = (follows: typeof sampleFollows) => ({
      app: {
        bsky: {
          graph: {
            getFollows: mock.fn(async () => ({
              success: true,
              data: { follows, cursor: undefined },
            })),
          },
        },
      },
    });

    // sets the service's internal public AtpAgent mock to return the given followers
    const setPublicAgentFollowers = (followers: typeof sampleFollows) => {
      (profileService as any).agent = {
        ...(profileService as any).agent,
        app: {
          bsky: {
            graph: {
              getFollowers: mock.fn(async () => ({
                success: true,
                data: { followers, cursor: undefined },
              })),
            },
          },
        },
      };
    };

    it("should separate moots, following-only, and followers-only", async () => {
      // user:1 = mutual, user:3 = I follow them (not back), user:2 = they follow me (not back)
      const mockAgent = makeAuthAgent([sampleFollows[0], sampleFollows[2]]);
      setPublicAgentFollowers([sampleFollows[0], sampleFollows[1]]);
      mockSelectBuilder.execute = async () => [
        { did: "did:user:1" },
        { did: "did:user:2" },
        { did: "did:user:3" },
      ];

      const result = await profileService.getFriendsOnApp("did:owner:1", mockAgent as any);

      assert.strictEqual(result.moots.length, 1);
      assert.strictEqual(result.moots[0].did, "did:user:1");
      assert.strictEqual(result.moots[0].displayName, "User One");
      assert.strictEqual(result.moots[0].avatar, "https://cdn.test/1.jpg");
      assert.strictEqual(result.following.length, 1);
      assert.strictEqual(result.following[0].did, "did:user:3");
      assert.strictEqual(result.oomfs.length, 1);
      assert.strictEqual(result.oomfs[0].did, "did:user:2");
    });

    it("should put followers-only users in oomfs", async () => {
      // user:2 follows me but I don't follow them
      const mockAgent = makeAuthAgent([]);
      setPublicAgentFollowers([sampleFollows[1]]);
      mockSelectBuilder.execute = async () => [{ did: "did:user:2" }];

      const result = await profileService.getFriendsOnApp("did:owner:1", mockAgent as any);

      assert.strictEqual(result.moots.length, 0);
      assert.strictEqual(result.following.length, 0);
      assert.strictEqual(result.oomfs.length, 1);
      assert.strictEqual(result.oomfs[0].did, "did:user:2");
    });

    it("should put following-only users in following", async () => {
      // user:3 I follow but they don't follow back
      const mockAgent = makeAuthAgent([sampleFollows[2]]);
      setPublicAgentFollowers([]);
      mockSelectBuilder.execute = async () => [{ did: "did:user:3" }];

      const result = await profileService.getFriendsOnApp("did:owner:1", mockAgent as any);

      assert.strictEqual(result.moots.length, 0);
      assert.strictEqual(result.following.length, 1);
      assert.strictEqual(result.following[0].did, "did:user:3");
      assert.strictEqual(result.oomfs.length, 0);
    });

    it("should return empty when nobody is on the app", async () => {
      const mockAgent = makeAuthAgent(sampleFollows);
      setPublicAgentFollowers([]);
      mockSelectBuilder.execute = async () => [];

      const result = await profileService.getFriendsOnApp("did:owner:1", mockAgent as any);

      assert.strictEqual(result.moots.length, 0);
      assert.strictEqual(result.following.length, 0);
      assert.strictEqual(result.oomfs.length, 0);
    });

    it("should return empty when user has no follows or followers", async () => {
      const mockAgent = makeAuthAgent([]);
      setPublicAgentFollowers([]);

      const result = await profileService.getFriendsOnApp("did:owner:1", mockAgent as any);

      assert.strictEqual(result.moots.length, 0);
      assert.strictEqual(result.following.length, 0);
      assert.strictEqual(result.oomfs.length, 0);
      // No DB query should be made when both lists are empty
      assert.strictEqual(mockDb.selectFrom.mock.calls.length, 0);
    });

    it("should follow cursor pagination for follows across multiple pages", async () => {
      let followsCallCount = 0;
      const paginatedAgent = {
        app: {
          bsky: {
            graph: {
              getFollows: mock.fn(async (params: any) => {
                followsCallCount++;
                if (followsCallCount === 1) {
                  return {
                    success: true,
                    data: {
                      follows: [{ did: "did:user:1", handle: "user1.bsky.app", displayName: "Page1", avatar: undefined }],
                      cursor: "page2-cursor",
                    },
                  };
                }
                return {
                  success: true,
                  data: {
                    follows: [{ did: "did:user:2", handle: "user2.bsky.app", displayName: "Page2", avatar: undefined }],
                    cursor: undefined,
                  },
                };
              }),
            },
          },
        },
      };
      setPublicAgentFollowers([]);
      mockSelectBuilder.execute = async () => [{ did: "did:user:1" }, { did: "did:user:2" }];

      const result = await profileService.getFriendsOnApp("did:owner:1", paginatedAgent as any);

      assert.strictEqual(followsCallCount, 2);
      assert.strictEqual(result.following.length, 2);
      // Verify cursor was forwarded on the second call
      const secondCallArgs = (paginatedAgent.app.bsky.graph.getFollows as any).mock.calls[1].arguments[0];
      assert.strictEqual(secondCallArgs.cursor, "page2-cursor");
    });

    it("should stop fetching when getFollows returns success: false", async () => {
      const failingAgent = {
        app: {
          bsky: {
            graph: {
              getFollows: mock.fn(async () => ({ success: false, data: {} })),
            },
          },
        },
      };
      setPublicAgentFollowers([]);

      const result = await profileService.getFriendsOnApp("did:owner:1", failingAgent as any);

      assert.strictEqual(result.moots.length, 0);
      assert.strictEqual(result.following.length, 0);
      assert.strictEqual(result.oomfs.length, 0);
    });

    it("should stop fetching after 5 pages when cursor never clears (max page limit)", async () => {
      let followsCallCount = 0;
      const paginatedAgent = {
        app: {
          bsky: {
            graph: {
              getFollows: mock.fn(async () => {
                followsCallCount++;
                return {
                  success: true,
                  data: {
                    follows: [{ did: `did:user:page${followsCallCount}`, handle: `u${followsCallCount}.bsky.app`, displayName: undefined, avatar: undefined }],
                    cursor: `page${followsCallCount + 1}`,
                  },
                };
              }),
            },
          },
        },
      };
      setPublicAgentFollowers([]);
      mockSelectBuilder.execute = async () => [];

      await profileService.getFriendsOnApp("did:owner:1", paginatedAgent as any);

      assert.strictEqual(followsCallCount, 5);
    });

    it("should use empty array fallback when fetchPages response has neither follows nor followers", async () => {
      const agentWithEmptyData = {
        app: {
          bsky: {
            graph: {
              getFollows: mock.fn(async () => ({
                success: true,
                data: { cursor: undefined },
              })),
            },
          },
        },
      };
      setPublicAgentFollowers([]);

      const result = await profileService.getFriendsOnApp("did:owner:1", agentWithEmptyData as any);

      assert.strictEqual(result.moots.length, 0);
      assert.strictEqual(result.following.length, 0);
      assert.strictEqual(result.oomfs.length, 0);
    });
  });
});
