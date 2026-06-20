import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import Login from "../../pages/Login";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useLogin: vi.fn() };
});

const mockUseLogin = vi.mocked(authService.useLogin);

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders handle input and submit button", () => {
    mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<Login />);
    expect(screen.getByLabelText(/bluesky handle/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with bluesky/i })).toBeInTheDocument();
  });

  it("shows error notification when URL contains ?error=oauth_failed", () => {
    mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<Login />, { route: "/login?error=oauth_failed" });
    expect(screen.getByText(/login failed. please try again/i)).toBeInTheDocument();
  });

  it("shows validation error when submitting an empty handle", async () => {
    mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<Login />);
    // Submit the form directly to bypass browser's native required-field validation
    const form = screen.getByLabelText(/bluesky handle/i).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/handle is required/i)).toBeInTheDocument();
    });
  });

  it("calls login mutation with the typed handle", async () => {
    const mockMutate = vi.fn();
    mockUseLogin.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Login />);

    fireEvent.change(screen.getByLabelText(/bluesky handle/i), {
      target: { value: "karan.bsky.social" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with bluesky/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ handle: "karan.bsky.social" }, expect.any(Object));
    });
  });

  it("shows API error message returned from the mutation", async () => {
    let capturedCallbacks: any;
    const mockMutate = vi.fn((_data, callbacks) => {
      capturedCallbacks = callbacks;
    });
    mockUseLogin.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Login />);

    fireEvent.change(screen.getByLabelText(/bluesky handle/i), {
      target: { value: "karan.bsky.social" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with bluesky/i }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    act(() => {
      capturedCallbacks.onError({ error: "Handle not found on Bluesky" });
    });

    expect(screen.getByText(/handle not found on bluesky/i)).toBeInTheDocument();
  });

  it("shows loading state on the button while mutation is pending", () => {
    mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: true } as any);
    renderWithProviders(<Login />);
    const button = screen.getByRole("button", {
      name: /continue with bluesky/i,
    });
    expect(button).toBeDisabled();
  });

  it("closing the error alert clears the error", async () => {
    mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<Login />, { route: "/login?error=oauth_failed" });
    expect(screen.getByText(/login failed. please try again/i)).toBeInTheDocument();
    const alertEl = screen.getByRole("alert");
    const closeBtn = alertEl.querySelector("button");
    if (closeBtn) fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText(/login failed. please try again/i)).toBeNull();
    });
  });

  it("redirects to redirectUrl and sets newLogin flag on successful login", async () => {
    let capturedCallbacks: any;
    const mockMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseLogin.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Login />);

    fireEvent.change(screen.getByLabelText(/bluesky handle/i), {
      target: { value: "karan.bsky.social" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with bluesky/i }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess({
        redirectUrl: "https://bsky.app/oauth/authorize",
      });
    });

    expect(sessionStorage.getItem("newLogin")).toBe("true");
    expect(window.location.href).toBe("https://bsky.app/oauth/authorize");
  });

  it("does nothing when onSuccess is called without a redirectUrl", async () => {
    let capturedCallbacks: any;
    const mockMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseLogin.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Login />);

    fireEvent.change(screen.getByLabelText(/bluesky handle/i), {
      target: { value: "karan.bsky.social" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with bluesky/i }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess({});
    });

    // No redirect happened; component remains rendered without error
    expect(screen.getByLabelText(/bluesky handle/i)).toBeInTheDocument();
  });

  it("shows fallback error message when err.error is absent", async () => {
    let capturedCallbacks: any;
    const mockMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseLogin.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Login />);

    fireEvent.change(screen.getByLabelText(/bluesky handle/i), {
      target: { value: "karan.bsky.social" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with bluesky/i }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({});
    });

    expect(screen.getByText(/login failed. please try again/i)).toBeInTheDocument();
  });

  it("renders correctly in dark mode (covers dark-style branches)", () => {
    mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<Login />, { colorScheme: "dark" });
    expect(screen.getByLabelText(/bluesky handle/i)).toBeInTheDocument();
  });
});
