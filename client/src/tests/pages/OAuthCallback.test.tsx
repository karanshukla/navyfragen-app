import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as apiClientModule from "../../api/apiClient";
import OAuthCallback from "../../pages/OAuthCallback";
import { renderWithProviders } from "../testUtils";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../api/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/apiClient")>();
  return { ...actual, apiClient: { ...actual.apiClient, post: vi.fn() } };
});

const mockPost = vi.mocked(apiClientModule.apiClient.post);

describe("OAuthCallback page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while consuming the token", async () => {
    mockPost.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<OAuthCallback />, {
      route: "/oauth_callback?oauth_token=abc123",
    });
    expect(screen.getByText(/logging you in/i)).toBeInTheDocument();
  });

  it("shows error when oauth_token is absent from URL", async () => {
    renderWithProviders(<OAuthCallback />, { route: "/oauth_callback" });
    await waitFor(() => {
      expect(screen.getByText(/missing oauth token/i)).toBeInTheDocument();
    });
  });

  it("navigates to /messages after a successful token consume", async () => {
    mockPost.mockResolvedValue({ success: true });
    renderWithProviders(<OAuthCallback />, {
      route: "/oauth_callback?oauth_token=validtoken",
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/messages");
    });
  });

  it("shows API error when token consume fails", async () => {
    mockPost.mockRejectedValue({ error: "Token expired or invalid" });
    renderWithProviders(<OAuthCallback />, {
      route: "/oauth_callback?oauth_token=badtoken",
    });
    await waitFor(() => {
      expect(screen.getByText(/token expired or invalid/i)).toBeInTheDocument();
    });
  });

  it("shows err.message as fallback when err.error is absent", async () => {
    mockPost.mockRejectedValue({ message: "Network connection failed" });
    renderWithProviders(<OAuthCallback />, {
      route: "/oauth_callback?oauth_token=badtoken",
    });
    await waitFor(() => {
      expect(screen.getByText(/network connection failed/i)).toBeInTheDocument();
    });
  });

  it("shows generic fallback message when both err.error and err.message are absent", async () => {
    mockPost.mockRejectedValue({});
    renderWithProviders(<OAuthCallback />, {
      route: "/oauth_callback?oauth_token=badtoken",
    });
    await waitFor(() => {
      expect(screen.getByText(/failed to complete oauth login/i)).toBeInTheDocument();
    });
  });

  it("renders correctly in dark mode (covers dark-style branches)", async () => {
    mockPost.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<OAuthCallback />, {
      route: "/oauth_callback?oauth_token=abc123",
      colorScheme: "dark",
    });
    expect(screen.getByText(/logging you in/i)).toBeInTheDocument();
  });
});
