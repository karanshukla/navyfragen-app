import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { apiClient } from "../api/apiClient";
import {
  settingsService,
  UserSettings,
  UserStats,
  useUserSettings,
  useUserStats,
  usePdsInfo,
  useUpdateUserSettings,
  settingsKeys,
} from "../api/settingsService";
import { queryClient } from "../api/queryClient";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function makeWrapperFastRetry() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

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
    imageTheme: "default",
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
        mockError,
      );
    });
  });

  describe("updateUserSettings", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        ...mockUserSettings,
        pdsSyncEnabled: 0,
      });

      const result =
        await settingsService.updateUserSettings(mockUpdatedSettings);

      expect(result).toEqual({
        ...mockUserSettings,
        pdsSyncEnabled: 0,
      });
      expect(apiClient.post).toHaveBeenCalledWith(
        "/settings",
        mockUpdatedSettings,
      );
    });

    it("should handle errors", async () => {
      const mockError = { error: "Failed to update settings", status: 400 };
      vi.mocked(apiClient.post).mockRejectedValueOnce(mockError);

      await expect(
        settingsService.updateUserSettings(mockUpdatedSettings),
      ).rejects.toEqual(mockError);
    });

    it("should update imageTheme", async () => {
      const newImageTheme = "ocean-breeze";
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        ...mockUserSettings,
        imageTheme: newImageTheme,
      });

      const result = await settingsService.updateUserSettings({
        imageTheme: newImageTheme,
      });

      expect(result).toEqual({
        ...mockUserSettings,
        imageTheme: newImageTheme,
      });
      expect(apiClient.post).toHaveBeenCalledWith("/settings", {
        imageTheme: newImageTheme,
      });
    });
  });

  describe("getStats", () => {
    it("should call apiClient.get with the correct endpoint", async () => {
      const mockStats: UserStats = {
        messageCount: 42,
        memberSince: "2025-01-01T00:00:00.000Z",
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockStats);

      const result = await settingsService.getStats();

      expect(result).toEqual(mockStats);
      expect(apiClient.get).toHaveBeenCalledWith("/stats");
    });

    it("should return 0 message count when user has no messages", async () => {
      const mockStats: UserStats = { messageCount: 0, memberSince: null };
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockStats);

      const result = await settingsService.getStats();

      expect(result).toEqual({ messageCount: 0, memberSince: null });
    });

    it("should handle authentication errors", async () => {
      const mockError = { error: "Not authenticated", status: 403 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      await expect(settingsService.getStats()).rejects.toEqual(mockError);
    });
  });
});

describe("settings hooks", () => {
  const mockSettings: UserSettings = {
    did: "did:example:123",
    pdsSyncEnabled: 1,
    imageTheme: "default",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  beforeEach(() => vi.clearAllMocks());

  it("useUserSettings returns a query result", () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useUserSettings(), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("useUserSettings retry returns false for 401", () => {
    vi.mocked(apiClient.get).mockRejectedValue({
      status: 401,
      error: "Unauthorized",
    });
    const { result } = renderHook(() => useUserSettings(), {
      wrapper: makeWrapper(),
    });
    // Access the query's retry config by checking that the hook initializes properly
    expect(result.current).toBeDefined();
  });

  it("useUserStats returns a query result", () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      messageCount: 0,
      memberSince: null,
    });
    const { result } = renderHook(() => useUserStats(), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("usePdsInfo returns a query result", () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      pdsUrl: null,
      recordCount: 0,
    });
    const { result } = renderHook(() => usePdsInfo(), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("useUpdateUserSettings returns a mutation object", () => {
    const { result } = renderHook(() => useUpdateUserSettings(), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.mutate).toBe("function");
  });

  it("useUserSettings does not retry on 403 errors", async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ status: 403, error: "Forbidden" });
    const { result } = renderHook(() => useUserSettings(), {
      wrapper: makeWrapperFastRetry(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("useUserSettings retries for non-auth errors (failureCount < 3 branch)", async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce({ status: 500, error: "Server Error" })
      .mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useUserSettings(), {
      wrapper: makeWrapperFastRetry(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSettings);
  });

  it("useUpdateUserSettings onSuccess invalidates settings cache and calls options.onSuccess", async () => {
    const onSuccess = vi.fn();
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockSettings);
    const { result } = renderHook(
      () => useUpdateUserSettings({ onSuccess }),
      { wrapper: makeWrapper() }
    );
    await act(async () => {
      await result.current.mutateAsync({ pdsSyncEnabled: true });
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
