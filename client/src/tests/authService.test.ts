import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../api/apiClient";
import {
  authService,
  useSession,
  useLogin,
  useLogout,
  SessionResponse,
} from "../api/authService";
import { queryClient } from "../api/queryClient";

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
        mockError
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

describe("auth hooks structure", () => {
  it("should have the correct structure", () => {
    expect(typeof useSession).toBe("function");
    expect(typeof useLogin).toBe("function");
    expect(typeof useLogout).toBe("function");
  });
});
