import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../api/apiClient";
import { profileService } from "../api/profileService";

vi.mock("../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("profileService", () => {
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
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockProfileResponse);

      const result = await profileService.getPublicProfile(mockDid);

      expect(result).toEqual(mockProfileResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/public-profile/${encodeURIComponent(mockDid)}`
      );
    });

    it("should handle errors", async () => {
      const mockError = { error: "Profile not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      await expect(profileService.getPublicProfile(mockDid)).rejects.toEqual(
        mockError
      );
    });
  });

  describe("userExists", () => {
    it("should call apiClient.get with the correct endpoint", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUserExistsResponse);

      const result = await profileService.userExists(mockDid);

      expect(result).toEqual(mockUserExistsResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/user-exists/${encodeURIComponent(mockDid)}`
      );
    });

    it("should handle non-existent users", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        exists: false,
        did: null,
      });

      const result = await profileService.userExists(mockDid);

      expect(result).toEqual({
        exists: false,
        did: null,
      });
    });
  });

  describe("resolveHandle", () => {
    it("should call apiClient.get with the correct endpoint", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResolveHandleResponse);

      const result = await profileService.resolveHandle(mockHandle);

      expect(result).toEqual(mockResolveHandleResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/resolve/${encodeURIComponent(mockHandle)}`
      );
    });

    it("should handle errors", async () => {
      const mockError = { error: "Handle not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      await expect(profileService.resolveHandle(mockHandle)).rejects.toEqual(
        mockError
      );
    });
  });
});
