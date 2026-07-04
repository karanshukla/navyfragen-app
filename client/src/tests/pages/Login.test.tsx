import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as authService from "../../api/authService";
import Login from "../../pages/Login";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useLogin: vi.fn(), useE2ELogin: vi.fn() };
});

const mockUseLogin = vi.mocked(authService.useLogin);
const mockUseE2ELogin = vi.mocked(authService.useE2ELogin);

function getHandleInput() {
  return screen.getByRole("textbox", { name: /atmosphere handle/i });
}

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders handle input and submit button", () => {
    mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<Login />);
    expect(getHandleInput()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("shows error notification when URL contains ?error=oauth_failed", () => {
    mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<Login />, { route: "/login?error=oauth_failed" });
    expect(screen.getByText(/login failed. please try again/i)).toBeInTheDocument();
  });

  it("does not call login mutation when handle is empty", async () => {
    const mockMutate = vi.fn();
    mockUseLogin.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
    renderWithProviders(<Login />);
    const form = getHandleInput().closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

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
      name: /continue/i,
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
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

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
        expect.stringContaining("handle-search?q=ali"),
        expect.objectContaining({ credentials: "include" })
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

    it("silently ignores fetch network errors", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      fireEvent.change(getHandleInput(), { target: { value: "ali" } });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(getHandleInput()).toBeInTheDocument();
    });
  });

  describe("handle suggestion selection", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("sorts and renders multiple suggestions, allowing selection of the top match", async () => {
      const mockActors = [
        { did: "did:plc:def", handle: "alicia.bsky.social", displayName: "Alicia" },
        { did: "did:plc:abc", handle: "ali.bsky.social", displayName: "Ali" },
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ actors: mockActors }),
        })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      fireEvent.change(getHandleInput(), { target: { value: "ali" } });

      // Exact handle match ("ali.bsky.social") should be ranked first.
      const suggestionRow = await screen.findByRole("option", {}, { timeout: 2000 });
      expect(suggestionRow).toHaveTextContent("Ali");

      fireEvent.click(suggestionRow);
      expect((getHandleInput() as HTMLInputElement).value).toBe("ali.bsky.social");
    });

    it("offers the typed handle directly when there are no search results", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ actors: [] }),
        })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      fireEvent.change(getHandleInput(), { target: { value: "unknown.example.com" } });

      const suggestionRow = await screen.findByText("@unknown.example.com", {}, { timeout: 2000 });
      fireEvent.click(suggestionRow);
      expect((getHandleInput() as HTMLInputElement).value).toBe("unknown.example.com");
    });

    it("auto-selects a single suggestion that exactly matches the typed handle", async () => {
      const mockActors = [
        { did: "did:plc:abc", handle: "karan.bsky.social", displayName: "Karan" },
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ actors: mockActors }),
        })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      fireEvent.change(getHandleInput(), { target: { value: "karan.bsky.social" } });

      await waitFor(() => expect(screen.getByText("Karan")).toBeInTheDocument(), { timeout: 2000 });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("ranks a suggestion with no matching prefix last and clears a manual selection on Escape", async () => {
      const mockActors = [
        { did: "did:plc:karina", handle: "karina.bsky.social", displayName: "Karina" },
        { did: "did:plc:karan", handle: "karan.bsky.social", displayName: "Karan" },
        { did: "did:plc:zzz", handle: "zzz.bsky.social", displayName: "Zzz" },
        // Handle doesn't match the prefix, but the display name does (rank 3).
        { did: "did:plc:disp", handle: "unrelated.bsky.social", displayName: "Karenina" },
        // Neither handle nor (missing) display name match — falls to the `?? ""` fallback.
        { did: "did:plc:nodisp", handle: "other.bsky.social", displayName: undefined },
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ actors: mockActors }),
        })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      const input = getHandleInput();
      fireEvent.change(input, { target: { value: "kar" } });

      const suggestionRow = await screen.findByRole("option", {}, { timeout: 2000 });
      fireEvent.click(suggestionRow);
      expect(screen.queryByRole("option")).not.toBeInTheDocument();

      fireEvent.keyDown(input, { key: "Escape" });
      expect(await screen.findByRole("option", {}, { timeout: 2000 })).toBeInTheDocument();
    });

    it("clears a manual selection when the user resumes typing", async () => {
      const mockActors = [
        { did: "did:plc:abc", handle: "karan.bsky.social", displayName: "Karan" },
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ actors: mockActors }),
        })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      const input = getHandleInput();
      fireEvent.change(input, { target: { value: "kar" } });
      const suggestionRow = await screen.findByRole("option", {}, { timeout: 2000 });
      fireEvent.click(suggestionRow);
      expect(screen.getByText("Karan")).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "karan.bsky.socia" } });
      // Typing again clears the manual selection; the static "selected" row disappears.
      await waitFor(() => expect(screen.queryByText("Karan")).not.toBeInTheDocument());
    });

    it("shows 'No handles found' and tolerates a response with no actors field", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      // Two characters, no dot: search runs but the handle is not "ready" yet, so the
      // typed-handle offer is skipped and the plain "No handles found" branch renders.
      fireEvent.change(getHandleInput(), { target: { value: "ab" } });

      expect(
        await screen.findByText(/no handles found/i, {}, { timeout: 2000 })
      ).toBeInTheDocument();
    });

    it("navigates with ArrowDown into the suggestion and back to the input with Escape", async () => {
      const mockActors = [{ did: "did:plc:abc", handle: "someone.bsky.social" }];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ actors: mockActors }),
        })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      const input = getHandleInput();
      fireEvent.change(input, { target: { value: "some" } });

      const suggestionRow = await screen.findByRole("option", {}, { timeout: 2000 });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(document.activeElement).toBe(suggestionRow);

      fireEvent.keyDown(suggestionRow, { key: "Escape" });
      expect(document.activeElement).toBe(input);
    });

    it("moves focus back to the input when ArrowUp is pressed on a suggestion", async () => {
      const mockActors = [{ did: "did:plc:abc", handle: "someone.bsky.social" }];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ actors: mockActors }),
        })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      const input = getHandleInput();
      fireEvent.change(input, { target: { value: "some" } });

      const suggestionRow = await screen.findByRole("option", {}, { timeout: 2000 });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(suggestionRow, { key: "ArrowUp" });
      expect(document.activeElement).toBe(input);
    });

    it("ignores unrelated keys on a suggestion row and on the main input", async () => {
      const mockActors = [{ did: "did:plc:abc", handle: "someone.bsky.social" }];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ actors: mockActors }),
        })
      );
      mockUseLogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
      renderWithProviders(<Login />);

      const input = getHandleInput();
      fireEvent.change(input, { target: { value: "some" } });

      const suggestionRow = await screen.findByRole("option", {}, { timeout: 2000 });
      fireEvent.keyDown(suggestionRow, { key: "a" });
      expect(suggestionRow).toBeInTheDocument();

      fireEvent.keyDown(input, { key: "a" });
      expect(document.activeElement).not.toBe(suggestionRow);
    });
  });

  it("shows a validation error when the typed handle exceeds the max length", async () => {
    const mockMutate = vi.fn();
    mockUseLogin.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
    renderWithProviders(<Login />);

    const longHandle = `${"a".repeat(70)}.bsky.social`;
    fireEvent.change(getHandleInput(), { target: { value: longHandle } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/handle too long/i)).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  describe("E2ELoginPanel", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_E2E_TESTING", "true");
      mockUseE2ELogin.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("renders identifier and password inputs in E2E mode", () => {
      renderWithProviders(<Login />);
      expect(screen.getByTestId("e2e-identifier")).toBeInTheDocument();
      expect(screen.getByTestId("e2e-password")).toBeInTheDocument();
      expect(screen.getByTestId("e2e-submit")).toBeInTheDocument();
    });

    it("calls e2eLogin mutation with identifier and password on submit", async () => {
      const mockMutate = vi.fn();
      mockUseE2ELogin.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
      renderWithProviders(<Login />);

      fireEvent.change(screen.getByTestId("e2e-identifier"), {
        target: { value: "user.bsky.social" },
      });
      fireEvent.change(screen.getByTestId("e2e-password"), {
        target: { value: "xxxx-xxxx-xxxx-xxxx" },
      });
      fireEvent.click(screen.getByTestId("e2e-submit"));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          { identifier: "user.bsky.social", password: "xxxx-xxxx-xxxx-xxxx" },
          expect.any(Object)
        );
      });
    });

    function submitE2EForm() {
      fireEvent.change(screen.getByTestId("e2e-identifier"), {
        target: { value: "user.bsky.social" },
      });
      fireEvent.change(screen.getByTestId("e2e-password"), {
        target: { value: "xxxx-xxxx-xxxx-xxxx" },
      });
      fireEvent.click(screen.getByTestId("e2e-submit"));
    }

    it("navigates to /messages on e2eLogin success", async () => {
      let capturedCallbacks: any;
      const mockMutate = vi.fn((_data: any, callbacks: any) => {
        capturedCallbacks = callbacks;
      });
      mockUseE2ELogin.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
      renderWithProviders(<Login />);

      submitE2EForm();
      await waitFor(() => expect(mockMutate).toHaveBeenCalled());

      act(() => {
        capturedCallbacks.onSuccess();
      });

      // MemoryRouter doesn't change window.location; component stays rendered
      expect(screen.getByTestId("e2e-submit")).toBeInTheDocument();
    });

    it("shows error message on e2eLogin failure", async () => {
      let capturedCallbacks: any;
      const mockMutate = vi.fn((_data: any, callbacks: any) => {
        capturedCallbacks = callbacks;
      });
      mockUseE2ELogin.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
      renderWithProviders(<Login />);

      submitE2EForm();
      await waitFor(() => expect(mockMutate).toHaveBeenCalled());

      act(() => {
        capturedCallbacks.onError({ error: "Invalid credentials" });
      });

      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });

    it("shows fallback error when e2eLogin err.error is absent", async () => {
      let capturedCallbacks: any;
      const mockMutate = vi.fn((_data: any, callbacks: any) => {
        capturedCallbacks = callbacks;
      });
      mockUseE2ELogin.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
      renderWithProviders(<Login />);

      submitE2EForm();
      await waitFor(() => expect(mockMutate).toHaveBeenCalled());

      act(() => {
        capturedCallbacks.onError({});
      });

      expect(screen.getByText(/e2e login failed/i)).toBeInTheDocument();
    });

    it("clears error alert when close button is clicked", async () => {
      let capturedCallbacks: any;
      const mockMutate = vi.fn((_data: any, callbacks: any) => {
        capturedCallbacks = callbacks;
      });
      mockUseE2ELogin.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
      renderWithProviders(<Login />);

      submitE2EForm();
      await waitFor(() => expect(mockMutate).toHaveBeenCalled());

      act(() => {
        capturedCallbacks.onError({ error: "Something went wrong" });
      });

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      const closeBtn = screen.getByRole("alert").querySelector("button");
      if (closeBtn) fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText(/something went wrong/i)).toBeNull();
      });
    });

    it("shows loading state on submit button while e2eLogin is pending", () => {
      mockUseE2ELogin.mockReturnValue({ mutate: vi.fn(), isPending: true } as any);
      renderWithProviders(<Login />);
      expect(screen.getByTestId("e2e-submit")).toBeDisabled();
    });
  });
});
