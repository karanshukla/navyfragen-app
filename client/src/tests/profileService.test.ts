import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../api/apiClient";
import { profileService } from "../api/profileService";

// Mock dependencies
vi.mock("../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("profileService", () => {
  // Mock data
  const mockDid = "did:example:123";
  const mockHandle = "user.example.com";

  const mockProfileResponse = {
    profile: {
      did: mockDid,
      handle: mockHandle,
      displayName: "Test User",
      description: "This is a test profile",
      avatar: "https://example.com/avatar.jpg",
      banner: "https://example.com/banner.jpg",
    },
  };

  const mockUserExistsResponse = {
    exists: true,
    did: mockDid,
  };

  const mockResolveHandleResponse = {
    did: mockDid,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getPublicProfile", () => {
    it("should call apiClient.get with the correct endpoint", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockProfileResponse);

      // Call the service
      const result = await profileService.getPublicProfile(mockDid);

      // Verify the result
      expect(result).toEqual(mockProfileResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/public-profile/${encodeURIComponent(mockDid)}`
      );
    });

    it("should handle errors", async () => {
      // Setup mock implementation for error
      const mockError = { error: "Profile not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      // Call the service and expect it to throw
      await expect(profileService.getPublicProfile(mockDid)).rejects.toEqual(
        mockError
      );
    });
  });

  describe("userExists", () => {
    it("should call apiClient.get with the correct endpoint", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUserExistsResponse);

      // Call the service
      const result = await profileService.userExists(mockDid);

      // Verify the result
      expect(result).toEqual(mockUserExistsResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/user-exists/${encodeURIComponent(mockDid)}`
      );
    });

    it("should handle non-existent users", async () => {
      // Setup mock implementation for non-existent user
      vi.mocked(apiClient.get).mockResolvedValueOnce({ exists: false });

      // Call the service
      const result = await profileService.userExists("did:example:nonexistent");

      // Verify the result
      expect(result).toEqual({ exists: false });
    });
  });

  describe("resolveHandle", () => {
    it("should call apiClient.get with the correct endpoint", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResolveHandleResponse);

      // Call the service
      const result = await profileService.resolveHandle(mockHandle);

      // Verify the result
      expect(result).toEqual(mockResolveHandleResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/resolve-handle/${encodeURIComponent(mockHandle)}`
      );
    });

    it("should handle invalid handles", async () => {
      // Setup mock implementation for error
      const mockError = { error: "Handle not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      // Call the service and expect it to throw
      await expect(
        profileService.resolveHandle("invalid.handle")
      ).rejects.toEqual(mockError);
    });
  });
});
