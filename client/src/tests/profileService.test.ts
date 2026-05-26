import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { apiClient } from "../api/apiClient";
import {
  profileService,
  FriendsResponse,
  usePublicProfile,
  useUserExists,
  useFriends,
  useBotFollow,
  useResolveHandle,
} from "../api/profileService";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
        `/public-profile/${encodeURIComponent(mockDid)}`,
      );
    });

    it("should handle errors", async () => {
      const mockError = { error: "Profile not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      await expect(profileService.getPublicProfile(mockDid)).rejects.toEqual(
        mockError,
      );
    });
  });

  describe("userExists", () => {
    it("should call apiClient.get with the correct endpoint", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUserExistsResponse);

      const result = await profileService.userExists(mockDid);

      expect(result).toEqual(mockUserExistsResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/user-exists/${encodeURIComponent(mockDid)}`,
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
        `/resolve-handle/${encodeURIComponent(mockHandle)}`,
      );
    });

    it("should handle errors", async () => {
      const mockError = { error: "Handle not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      await expect(profileService.resolveHandle(mockHandle)).rejects.toEqual(
        mockError,
      );
    });
  });

  describe("getFriends", () => {
    const mockFriendsResponse: FriendsResponse = {
      friends: [
        {
          did: "did:example:1",
          handle: "friend1.bsky.app",
          displayName: "Friend One",
          avatar: "https://cdn.bsky.app/1.jpg",
        },
        {
          did: "did:example:2",
          handle: "friend2.bsky.app",
          displayName: undefined,
          avatar: undefined,
        },
      ],
    };

    it("should call apiClient.get with the correct endpoint", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockFriendsResponse);

      const result = await profileService.getFriends();

      expect(result).toEqual(mockFriendsResponse);
      expect(apiClient.get).toHaveBeenCalledWith("/friends");
    });

    it("should return empty friends array when user has no friends on app", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ friends: [] });

      const result = await profileService.getFriends();

      expect(result).toEqual({ friends: [] });
      expect(apiClient.get).toHaveBeenCalledWith("/friends");
    });

    it("should return avatar URLs for friends that have them", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockFriendsResponse);

      const result = await profileService.getFriends();

      expect(result.friends[0].avatar).toBe("https://cdn.bsky.app/1.jpg");
      expect(result.friends[1].avatar).toBeUndefined();
    });

    it("should handle authentication errors", async () => {
      const mockError = { error: "Not authenticated", status: 403 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      await expect(profileService.getFriends()).rejects.toEqual(mockError);
    });
  });
});

describe("profile hooks", () => {
  const mockDid = "did:example:123";
  const mockHandle = "user.example.com";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("usePublicProfile returns query result", () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      profile: null,
      exists: false,
    });
    const { result } = renderHook(() => usePublicProfile(mockDid), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("usePublicProfile with null did is idle", () => {
    const { result } = renderHook(() => usePublicProfile(null), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useUserExists returns query result", () => {
    vi.mocked(apiClient.get).mockResolvedValue({ exists: true, did: mockDid });
    const { result } = renderHook(() => useUserExists(mockDid), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("useUserExists with null did is idle", () => {
    const { result } = renderHook(() => useUserExists(null), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useBotFollow returns query result", () => {
    vi.mocked(apiClient.get).mockResolvedValue({ following: false });
    const { result } = renderHook(() => useBotFollow(true), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("useBotFollow with enabled=false is idle", () => {
    const { result } = renderHook(() => useBotFollow(false), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useResolveHandle returns query result", () => {
    vi.mocked(apiClient.get).mockResolvedValue({ did: mockDid });
    const { result } = renderHook(() => useResolveHandle(mockHandle), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("useResolveHandle with null handle is idle", () => {
    const { result } = renderHook(() => useResolveHandle(null), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useFriends stores data in localStorage on success", async () => {
    const friendsData: FriendsResponse = {
      friends: [{ did: mockDid, handle: mockHandle }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(friendsData);
    const { result } = renderHook(() => useFriends(mockDid), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => result.current.isSuccess);
    const cached = JSON.parse(
      localStorage.getItem(`navyfragen_friends_cache_${mockDid}`)!,
    );
    expect(cached.data).toEqual(friendsData);
  });

  it("useFriends reads initialData from localStorage when available", () => {
    const cached = { data: { friends: [] }, timestamp: Date.now() };
    localStorage.setItem(
      `navyfragen_friends_cache_${mockDid}`,
      JSON.stringify(cached),
    );
    const { result } = renderHook(() => useFriends(mockDid), {
      wrapper: makeWrapper(),
    });
    expect(result.current.data).toEqual(cached.data);
  });

  it("useFriends returns undefined initialData when localStorage has invalid JSON", () => {
    localStorage.setItem(`navyfragen_friends_cache_${mockDid}`, "not-json");
    vi.mocked(apiClient.get).mockResolvedValue({ friends: [] });
    const { result } = renderHook(() => useFriends(mockDid), {
      wrapper: makeWrapper(),
    });
    // getCachedFriends catches JSON.parse error and returns null → initialData undefined
    expect(result.current.data).toBeUndefined();
  });

  it("useFriends with null did is idle", () => {
    const { result } = renderHook(() => useFriends(null), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
