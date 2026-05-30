import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { apiClient } from "../api/apiClient";
import {
  authService,
  useSession,
  useLogin,
  useLogout,
  authKeys,
  SessionResponse,
} from "../api/authService";
import { queryClient } from "../api/queryClient";

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
  },
}));

vi.mock("../api/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
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

      await expect(authService.login(mockLoginRequest)).rejects.toEqual(
        mockError,
      );
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
});

describe("auth hooks", () => {
  it("useSession returns a query result and executes the queryFn", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      isLoggedIn: true,
      profile: { did: "did:example:123", handle: "user.example.com" },
      did: "did:example:123",
    });
    const { result } = renderHook(() => useSession(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isLoggedIn).toBe(true);
  });

  it("useLogin returns a mutation object", () => {
    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });
    expect(typeof result.current.mutate).toBe("function");
  });

  it("useLogin executes the mutationFn with the provided data", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ redirectUrl: "https://example.com/auth" });
    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ handle: "user.example.com" });
    });
    expect(apiClient.post).toHaveBeenCalledWith("/login", { handle: "user.example.com" });
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
});
