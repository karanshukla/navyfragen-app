import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as authService from "../../api/authService";
import Login from "../../pages/Login";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useLogin: vi.fn() };
});

const mockUseLogin = vi.mocked(authService.useLogin);

function getHandleInput() {
  return screen.getByRole("combobox", { name: /bluesky handle/i });
}

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders handle input and submit button", () => {
    mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<Login />);
    expect(getHandleInput()).toBeInTheDocument();
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
    const form = getHandleInput().closest("form")!;
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

    fireEvent.change(getHandleInput(), {
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

    fireEvent.change(getHandleInput(), {
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

    fireEvent.change(getHandleInput(), {
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

    fireEvent.change(getHandleInput(), {
      target: { value: "karan.bsky.social" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with bluesky/i }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess({});
    });

    expect(getHandleInput()).toBeInTheDocument();
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

    fireEvent.change(getHandleInput(), {
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
    expect(getHandleInput()).toBeInTheDocument();
  });

  it("strips leading @ from handle before calling login", async () => {
    const mockMutate = vi.fn();
    mockUseLogin.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
    renderWithProviders(<Login />);

    fireEvent.change(getHandleInput(), {
      target: { value: "@karan.bsky.social" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with bluesky/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ handle: "karan.bsky.social" }, expect.any(Object));
    });
  });

  describe("handle autocomplete", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("fetches actor suggestions when query is 2+ chars", async () => {
      const mockActors = [
        {
          did: "did:plc:abc",
          handle: "alice.bsky.social",
          displayName: "Alice",
          avatar: "https://example.com/a.jpg",
        },
        {
          did: "did:plc:def",
          handle: "alicia.bsky.social",
          displayName: undefined,
          avatar: undefined,
        },
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ json: () => Promise.resolve({ actors: mockActors }) })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      fireEvent.change(getHandleInput(), { target: { value: "ali" } });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining("searchActorsTypeahead?q=ali"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it("clears suggestions and skips fetch when query is under 2 chars", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      fireEvent.change(getHandleInput(), { target: { value: "a" } });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("strips leading @ before searching", async () => {
      const mockActors = [
        { did: "did:plc:abc", handle: "karan.bsky.social", displayName: "Karan" },
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ json: () => Promise.resolve({ actors: mockActors }) })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      fireEvent.change(getHandleInput(), { target: { value: "@karan" } });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining("q=karan"),
        expect.any(Object)
      );
    });

    it("does nothing when fetch response lacks actors array", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) }));
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      fireEvent.change(getHandleInput(), { target: { value: "ali" } });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(vi.mocked(fetch)).toHaveBeenCalled();
      expect(getHandleInput()).toBeInTheDocument();
    });
  });
});
