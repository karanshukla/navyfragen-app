import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../api/apiClient";
import { settingsService, UserSettings } from "../api/settingsService";

vi.mock("../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("settingsService", () => {
  const mockDid = "did:example:123";

  const mockUserSettings: UserSettings = {
    did: mockDid,
    pdsSyncEnabled: 1,
    createdAt: "2025-06-07T12:00:00.000Z",
  };

  const mockUpdatedSettings: Partial<UserSettings> = {
    pdsSyncEnabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserSettings", () => {
    it("should call apiClient.get with the correct endpoint", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUserSettings);

      const result = await settingsService.getUserSettings();

      expect(result).toEqual(mockUserSettings);
      expect(apiClient.get).toHaveBeenCalledWith("/settings");
    });

    it("should handle errors", async () => {
      const mockError = { error: "Settings not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      await expect(settingsService.getUserSettings()).rejects.toEqual(
        mockError
      );
    });
  });

  describe("updateUserSettings", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        ...mockUserSettings,
        pdsSyncEnabled: 0,
      });

      const result = await settingsService.updateUserSettings(
        mockUpdatedSettings
      );

      expect(result).toEqual({
        ...mockUserSettings,
        pdsSyncEnabled: 0,
      });
      expect(apiClient.post).toHaveBeenCalledWith(
        "/settings",
        mockUpdatedSettings
      );
    });

    it("should handle errors", async () => {
      const mockError = { error: "Failed to update settings", status: 400 };
      vi.mocked(apiClient.post).mockRejectedValueOnce(mockError);

      await expect(
        settingsService.updateUserSettings(mockUpdatedSettings)
      ).rejects.toEqual(mockError);
    });
  });
});
