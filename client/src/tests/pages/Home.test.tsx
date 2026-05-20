import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import Home from "../../pages/Home";
import * as authService from "../../api/authService";
import * as messageService from "../../api/messageService";
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
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false, profile: null }, isLoading: false } as any);
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
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false, profile: null }, isLoading: false } as any);
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
});
