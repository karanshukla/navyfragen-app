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

// Mock dependencies
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

// Mock window.location
const originalLocation = window.location;
Object.defineProperty(window, "location", {
  writable: true,
  value: { href: "" },
});

describe("authService", () => {
  // Mock data
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
      // Setup mock implementation
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockSessionResponse);

      // Call the service
      const result = await authService.getSession();

      // Verify the result
      expect(result).toEqual(mockSessionResponse);
      expect(apiClient.get).toHaveBeenCalledWith("/session");
    });
  });

  describe("login", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockLoginResponse);

      // Call the service
      const result = await authService.login(mockLoginRequest);

      // Verify the result
      expect(result).toEqual(mockLoginResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/login", mockLoginRequest);
    });

    it("should handle login errors", async () => {
      // Setup mock implementation for error
      const mockError = { error: "Invalid handle", status: 400 };
      vi.mocked(apiClient.post).mockRejectedValueOnce(mockError);

      // Call the service and expect it to throw
      await expect(authService.login(mockLoginRequest)).rejects.toEqual(
        mockError
      );
    });
  });

  describe("logout", () => {
    it("should call apiClient.post with the correct endpoint", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockLogoutResponse);

      // Call the service
      const result = await authService.logout();

      // Verify the result
      expect(result).toEqual(mockLogoutResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/logout");
    });
  });
});

// We'll skip testing the hooks directly since they require more complex setup
// and would typically be tested with React Testing Library
// This would be done in a separate test focused on React components
describe("auth hooks structure", () => {
  it("should have the correct structure", () => {
    // Basic validation that the hooks exist and are functions
    expect(typeof useSession).toBe("function");
    expect(typeof useLogin).toBe("function");
    expect(typeof useLogout).toBe("function");
  });
});
