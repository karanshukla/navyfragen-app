import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { Navigation } from "../Navigation";
import * as profileService from "../api/profileService";
import * as settingsService from "../api/settingsService";
import { renderWithProviders } from "./testUtils";

vi.mock("../api/profileService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/profileService")>();
  return { ...actual, useFriends: vi.fn() };
});

vi.mock("../api/settingsService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/settingsService")>();
  return { ...actual, useUserStats: vi.fn() };
});

const mockUseFriends = vi.mocked(profileService.useFriends);
const mockUseUserStats = vi.mocked(settingsService.useUserStats);

const MOCK_FRIENDS = [
  {
    did: "did:example:1",
    handle: "alice.bsky.social",
    displayName: "Alice",
    avatar: "https://cdn.bsky.app/alice.jpg",
  },
  {
    did: "did:example:2",
    handle: "bob.bsky.social",
    displayName: undefined,
    avatar: undefined,
  },
];

describe("Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserStats.mockReturnValue({ data: undefined } as any);
  });

  describe("when logged out", () => {
    beforeEach(() => {
      mockUseFriends.mockReturnValue({ data: undefined, isLoading: false } as any);
    });

    it("renders Home and Login links", () => {
      renderWithProviders(<Navigation isLoggedIn={false} />);
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Login")).toBeInTheDocument();
    });

    it("does not render Messages or Settings links", () => {
      renderWithProviders(<Navigation isLoggedIn={false} />);
      expect(screen.queryByText("Messages")).toBeNull();
      expect(screen.queryByText("Settings")).toBeNull();
    });

    it("does not render the Friends section", () => {
      renderWithProviders(<Navigation isLoggedIn={false} />);
      expect(screen.queryByText(/friends on navyfragen/i)).toBeNull();
    });
  });

  describe("when logged in", () => {
    it("renders Home, Messages and Settings links", () => {
      mockUseFriends.mockReturnValue({ data: undefined, isLoading: true } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />);
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Messages")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("does not render Login link", () => {
      mockUseFriends.mockReturnValue({ data: undefined, isLoading: true } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />);
      expect(screen.queryByText("Login")).toBeNull();
    });

    it("renders the Friends section header", () => {
      mockUseFriends.mockReturnValue({ data: undefined, isLoading: false } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />);
      expect(screen.getByText(/friends on navyfragen/i)).toBeInTheDocument();
    });
  });

  describe("friends list — loading", () => {
    it("does not show friend names while loading", () => {
      mockUseFriends.mockReturnValue({ data: undefined, isLoading: true } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />);
      expect(screen.queryByText("Alice")).toBeNull();
      expect(screen.queryByText("@alice.bsky.social")).toBeNull();
    });
  });

  describe("friends list — empty", () => {
    it("shows the empty-state message when no friends are on the app", () => {
      mockUseFriends.mockReturnValue({ data: { friends: [] }, isLoading: false } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />);
      expect(
        screen.getByText(/none of the people you follow on bluesky are on navyfragen/i)
      ).toBeInTheDocument();
    });
  });

  describe("friends list — populated", () => {
    beforeEach(() => {
      mockUseFriends.mockReturnValue({
        data: { friends: MOCK_FRIENDS },
        isLoading: false,
      } as any);
    });

    it("renders displayName and @handle for each friend", () => {
      renderWithProviders(<Navigation isLoggedIn={true} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("@alice.bsky.social")).toBeInTheDocument();
      expect(screen.getByText("@bob.bsky.social")).toBeInTheDocument();
    });

    it("falls back to handle as the label when displayName is absent", () => {
      renderWithProviders(<Navigation isLoggedIn={true} />);
      // Bob has no displayName — the first Text renders the handle
      expect(screen.getByText("bob.bsky.social")).toBeInTheDocument();
    });

    it("links each friend to their profile page", () => {
      renderWithProviders(<Navigation isLoggedIn={true} />);
      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));
      expect(hrefs).toContain("/profile/alice.bsky.social");
      expect(hrefs).toContain("/profile/bob.bsky.social");
    });

    it("renders all friends without a load-more button", () => {
      const manyFriends = Array.from({ length: 20 }, (_, i) => ({
        did: `did:example:${i}`,
        handle: `user${i}.bsky.social`,
        displayName: `User ${i}`,
        avatar: undefined,
      }));
      mockUseFriends.mockReturnValue({
        data: { friends: manyFriends },
        isLoading: false,
      } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />);
      for (let i = 0; i < 20; i++) {
        expect(screen.getByText(`User ${i}`)).toBeInTheDocument();
      }
      expect(screen.queryByText(/load more/i)).toBeNull();
    });
  });
});
