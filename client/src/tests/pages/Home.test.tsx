import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import * as messageService from "../../api/messageService";
import Home from "../../pages/Home";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useSession: vi.fn() };
});

vi.mock("../../api/messageService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/messageService")>();
  return { ...actual, useSyncMessages: vi.fn() };
});

const mockUseSession = vi.mocked(authService.useSession);
const mockUseSyncMessages = vi.mocked(messageService.useSyncMessages);

const noopMutation = { mutate: vi.fn(), isPending: false } as any;

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSyncMessages.mockReturnValue(noopMutation);
  });

  it("shows skeleton while session is loading", () => {
    mockUseSession.mockReturnValue({ data: undefined, isLoading: true } as any);
    renderWithProviders(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: /navyfragen/i })).toBeInTheDocument();
    expect(screen.queryByText(/get started/i)).toBeNull();
    expect(screen.queryByText(/view your messages/i)).toBeNull();
  });

  it("shows feature list and Get Started button when logged out", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false, profile: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    expect(screen.getByRole("link", { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByText(/fast and free/i)).toBeInTheDocument();
    expect(screen.getByText(/open source/i)).toBeInTheDocument();
  });

  it("shows personalised welcome and Messages button when logged in", () => {
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        did: "did:example:123",
        profile: { displayName: "Karan", handle: "karan.bsky.social" },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    // Name appears inside a styled div (not a heading element)
    expect(screen.getByText("Karan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view your messages/i })).toBeInTheDocument();
  });

  it("renders Bluesky and GitHub links in the feedback section", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false, profile: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    const bskyLink = screen.getByRole("link", { name: /@navyfragen\.app/i });
    expect(bskyLink).toHaveAttribute("href", "https://bsky.app/profile/navyfragen.app");
    const githubLink = screen.getByRole("link", { name: /github/i });
    expect(githubLink).toHaveAttribute("href", "https://github.com/karanshukla/navyfragen-app");
  });

  it("falls back to handle when displayName is absent", () => {
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        did: "did:example:123",
        profile: { displayName: undefined, handle: "karan.bsky.social" },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    expect(screen.getByText("karan.bsky.social")).toBeInTheDocument();
  });

  it("renders avatar image when profile has an avatar URL", () => {
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        did: "did:example:123",
        profile: {
          displayName: "Karan",
          handle: "karan.bsky.social",
          avatar: "https://cdn.bsky.app/avatar.jpg",
        },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    const img = screen.getByRole("img", { name: /karan/i });
    expect(img).toHaveAttribute("src", "https://cdn.bsky.app/avatar.jpg");
  });

  it("shows Copy Link and Share buttons when logged in", () => {
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        did: "did:example:123",
        profile: { displayName: "Karan", handle: "karan.bsky.social" },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("clicking Share invokes navigator.share when available", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        did: "did:example:123",
        profile: { displayName: "Karan", handle: "karan.bsky.social" },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    await waitFor(() => expect(shareMock).toHaveBeenCalled());
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });

  it("clicking Share falls back to navigator.clipboard when share is unavailable", async () => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        did: "did:example:123",
        profile: { displayName: "Karan", handle: "karan.bsky.social" },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalled());
  });

  it("renders in dark mode when user is logged in (covers isDark style branches)", () => {
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        did: "did:example:123",
        profile: { displayName: "Karan", handle: "karan.bsky.social" },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />, { colorScheme: "dark" });
    expect(screen.getByText("Karan")).toBeInTheDocument();
  });

  it("clicking Copy Link changes button text to Copied!", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        did: "did:example:123",
        profile: { displayName: "Karan", handle: "karan.bsky.social" },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copied!/i })).toBeInTheDocument();
    });
  });

  it("clicking Share does nothing when neither navigator.share nor clipboard is available", async () => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        did: "did:example:123",
        profile: { displayName: "Karan", handle: "karan.bsky.social" },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    // Neither API available — no crash, nothing happens
    expect(document.body).toBeInTheDocument();
  });

  it("Copy Link and Share buttons are not shown when logged out", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false, profile: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Home />);
    expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /share/i })).toBeNull();
  });
});
