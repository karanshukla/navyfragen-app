import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { apiClient } from "../api/apiClient";
import {
  authService,
  useSession,
  useLogin,
  useLogout,
  useSwitchAccount,
  useE2ELogin,
  authKeys,
  SessionResponse,
} from "../api/authService";
import { clearFriendsCache } from "../api/profileService";
import { queryClient } from "../api/queryClient";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return Wrapper;
}

vi.mock("../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../api/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

vi.mock("../api/profileService", () => ({
  clearFriendsCache: vi.fn(),
}));

const originalLocation = window.location;
Object.defineProperty(window, "location", {
  writable: true,
  value: { href: "" },
});

describe("authService", () => {
  const mockSessionResponse: SessionResponse = {
    isLoggedIn: true,
    profile: {
      did: "did:example:123",
      handle: "user.example.com",
      displayName: "Test User",
      avatar: "https://example.com/avatar.jpg",
    },
    did: "did:example:123",
  };

  const mockLoginRequest = {
    handle: "user.example.com",
  };

  const mockLoginResponse = {
    redirectUrl: "https://example.com/auth",
  };

  const mockLogoutResponse = {
    message: "Logged out successfully",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  describe("getSession", () => {
    it("should call apiClient.get with the correct endpoint", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockSessionResponse);

      const result = await authService.getSession();

      expect(result).toEqual(mockSessionResponse);
      expect(apiClient.get).toHaveBeenCalledWith("/session");
    });
  });
  describe("login", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockLoginResponse);

      const result = await authService.login(mockLoginRequest);

      expect(result).toEqual(mockLoginResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/login", mockLoginRequest);
    });

    it("should handle login errors", async () => {
      const mockError = { error: "Invalid handle", status: 400 };
      vi.mocked(apiClient.post).mockRejectedValueOnce(mockError);

      await expect(authService.login(mockLoginRequest)).rejects.toEqual(mockError);
    });
  });
  describe("logout", () => {
    it("should call apiClient.post with the correct endpoint", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockLogoutResponse);

      const result = await authService.logout();

      expect(result).toEqual(mockLogoutResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/logout");
    });
  });

  describe("switchAccount", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      const mockResponse = { success: true, did: "did:example:456" };
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await authService.switchAccount({ did: "did:example:456" });

      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/accounts/switch", {
        did: "did:example:456",
      });
    });
  });

  describe("e2eLogin", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      const mockResponse = { success: true };
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await authService.e2eLogin({
        identifier: "user.example.com",
        password: "hunter2",
      });

      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/auth/e2e-login", {
        identifier: "user.example.com",
        password: "hunter2",
      });
    });
  });
});

describe("auth hooks", () => {
  it("useSession returns a query result and executes the queryFn", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      isLoggedIn: true,
      profile: { did: "did:example:123", handle: "user.example.com" },
      did: "did:example:123",
    });
    const { result } = renderHook(() => useSession(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isLoggedIn).toBe(true);
  });

  it("useLogin returns a mutation object", () => {
    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });
    expect(typeof result.current.mutate).toBe("function");
  });

  it("useLogin executes the mutationFn with the provided data", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      redirectUrl: "https://example.com/auth",
    });
    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ handle: "user.example.com" });
    });
    expect(apiClient.post).toHaveBeenCalledWith("/login", {
      handle: "user.example.com",
    });
  });

  it("useLogout returns a mutation object", () => {
    const { result } = renderHook(() => useLogout(), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.mutate).toBe("function");
  });

  it("useLogout.onSuccess invalidates session and redirects to root", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ message: "ok" });
    const { result } = renderHook(() => useLogout(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(vi.mocked(queryClient.invalidateQueries)).toHaveBeenCalledWith({
      queryKey: authKeys.session,
    });
    expect(window.location.href).toBe("/");
  });

  it("useSwitchAccount returns a mutation object", () => {
    const { result } = renderHook(() => useSwitchAccount(), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.mutate).toBe("function");
  });

  it("useSwitchAccount.onSuccess clears the friends cache for the new did", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      success: true,
      did: "did:example:789",
    });
    const { result } = renderHook(() => useSwitchAccount(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({ did: "did:example:789" });
    });
    expect(apiClient.post).toHaveBeenCalledWith("/accounts/switch", {
      did: "did:example:789",
    });
    expect(vi.mocked(clearFriendsCache)).toHaveBeenCalledWith("did:example:789");
  });

  it("useE2ELogin returns a mutation object", () => {
    const { result } = renderHook(() => useE2ELogin(), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.mutate).toBe("function");
  });

  it("useE2ELogin executes the mutationFn with the provided data", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useE2ELogin(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        identifier: "user.example.com",
        password: "hunter2",
      });
    });
    expect(apiClient.post).toHaveBeenCalledWith("/auth/e2e-login", {
      identifier: "user.example.com",
      password: "hunter2",
    });
  });
});
