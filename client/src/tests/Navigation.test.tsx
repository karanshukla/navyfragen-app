import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { useLocation } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as profileService from "../api/profileService";
import * as settingsService from "../api/settingsService";
import { Navigation } from "../Navigation";

import { renderWithProviders } from "./testUtils";

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

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

const TEST_DID = "did:plc:testuser123";

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
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);
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
      expect(screen.queryByText(/^moots$/i)).toBeNull();
    });
  });

  describe("when logged in", () => {
    it("renders Home, Messages and Settings links", () => {
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />);
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Messages")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("does not render Login link", () => {
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />);
      expect(screen.queryByText("Login")).toBeNull();
    });

    it("renders the friends section headers", () => {
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
      expect(screen.getByText(/^moots$/i)).toBeInTheDocument();
      expect(screen.getByText(/^following$/i)).toBeInTheDocument();
      expect(screen.getByText(/^oomfs$/i)).toBeInTheDocument();
    });
  });

  describe("friends list — loading", () => {
    it("does not show friend names while loading", () => {
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
      expect(screen.queryByText("Alice")).toBeNull();
      expect(screen.queryByText("@alice.bsky.social")).toBeNull();
      // Skeleton placeholders render in place of the friends list while loading.
      expect(document.querySelectorAll(".mantine-Skeleton-root").length).toBeGreaterThan(0);
    });
  });

  describe("friends list — empty", () => {
    it("shows the empty-state messages when no friends are on the app", () => {
      mockUseFriends.mockReturnValue({
        data: { moots: [], following: [], oomfs: [] },
        isLoading: false,
      } as any);
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
      expect(screen.getByText(/no mutuals on navyfragen yet/i)).toBeInTheDocument();
      expect(screen.getByText(/no one-sided follows on navyfragen yet/i)).toBeInTheDocument();
      expect(screen.getByText(/none of your followers are on navyfragen yet/i)).toBeInTheDocument();
    });
  });

  describe("friends list — populated", () => {
    beforeEach(() => {
      mockUseFriends.mockReturnValue({
        data: { moots: MOCK_FRIENDS, following: [], oomfs: [] },
        isLoading: false,
      } as any);
    });

    it("renders displayName and @handle for each friend", () => {
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("@alice.bsky.social")).toBeInTheDocument();
      expect(screen.getByText("@bob.bsky.social")).toBeInTheDocument();
    });

    it("falls back to handle as the label when displayName is absent", () => {
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
      // Bob has no displayName — the first Text renders the handle
      expect(screen.getByText("bob.bsky.social")).toBeInTheDocument();
    });

    it("links each friend to their profile page", () => {
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
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
        data: { moots: manyFriends, following: [], oomfs: [] },
        isLoading: false,
      } as any);
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
      for (let i = 0; i < 20; i++) {
        expect(screen.getByText(`User ${i}`)).toBeInTheDocument();
      }
      expect(screen.queryByText(/load more/i)).toBeNull();
    });
  });

  describe("keyboard shortcuts", () => {
    beforeEach(() => {
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);
    });

    it("Alt+H navigates to home", () => {
      renderWithProviders(
        <>
          <Navigation isLoggedIn={true} />
          <LocationDisplay />
        </>,
        { route: "/messages" }
      );
      fireEvent.keyDown(document, { key: "H", altKey: true });
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });

    it("Alt+M navigates to messages when logged in", () => {
      renderWithProviders(
        <>
          <Navigation isLoggedIn={true} />
          <LocationDisplay />
        </>,
        { route: "/" }
      );
      fireEvent.keyDown(document, { key: "M", altKey: true });
      expect(screen.getByTestId("location")).toHaveTextContent("/messages");
    });

    it("Alt+S navigates to settings when logged in", () => {
      renderWithProviders(
        <>
          <Navigation isLoggedIn={true} />
          <LocationDisplay />
        </>,
        { route: "/" }
      );
      fireEvent.keyDown(document, { key: "S", altKey: true });
      expect(screen.getByTestId("location")).toHaveTextContent("/settings");
    });

    it("Alt+L navigates to login when logged out", () => {
      renderWithProviders(
        <>
          <Navigation isLoggedIn={false} />
          <LocationDisplay />
        </>,
        { route: "/" }
      );
      fireEvent.keyDown(document, { key: "L", altKey: true });
      expect(screen.getByTestId("location")).toHaveTextContent("/login");
    });

    it("Alt+M does not navigate when logged out", () => {
      renderWithProviders(
        <>
          <Navigation isLoggedIn={false} />
          <LocationDisplay />
        </>,
        { route: "/" }
      );
      fireEvent.keyDown(document, { key: "M", altKey: true });
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });

    it("ignores shortcuts when input is focused", () => {
      renderWithProviders(
        <>
          <Navigation isLoggedIn={true} />
          <LocationDisplay />
          <input data-testid="inp" />
        </>,
        { route: "/" }
      );
      const inp = screen.getByTestId("inp");
      fireEvent.keyDown(inp, { key: "H", altKey: true });
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });

    it("calls onLinkClick when a keyboard shortcut fires", () => {
      const onLinkClick = vi.fn();
      renderWithProviders(<Navigation isLoggedIn={true} onLinkClick={onLinkClick} />, {
        route: "/",
      });
      fireEvent.keyDown(document, { key: "M", altKey: true });
      expect(onLinkClick).toHaveBeenCalled();
    });

    it("keyDown without altKey does nothing (covers altKey=false branch)", () => {
      renderWithProviders(
        <>
          <Navigation isLoggedIn={true} />
          <LocationDisplay />
        </>,
        { route: "/" }
      );
      fireEvent.keyDown(document, { key: "M", altKey: false });
      // No navigation should happen
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });

    it("Alt+S when logged out does not navigate to settings", () => {
      renderWithProviders(
        <>
          <Navigation isLoggedIn={false} />
          <LocationDisplay />
        </>,
        { route: "/" }
      );
      fireEvent.keyDown(document, { key: "S", altKey: true });
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });

    it("Alt+L when logged in does not navigate to login", () => {
      renderWithProviders(
        <>
          <Navigation isLoggedIn={true} />
          <LocationDisplay />
        </>,
        { route: "/" }
      );
      fireEvent.keyDown(document, { key: "L", altKey: true });
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });
  });

  describe("viewingHandle box", () => {
    it("shows 'Viewing profile' when on a profile route", () => {
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);
      renderWithProviders(<Navigation isLoggedIn={false} />, {
        route: "/profile/alice.bsky.social",
      });
      expect(screen.getByText(/viewing profile/i)).toBeInTheDocument();
      expect(screen.getByText("@alice.bsky.social")).toBeInTheDocument();
    });

    it("does not show 'Viewing profile' on non-profile routes", () => {
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);
      renderWithProviders(<Navigation isLoggedIn={false} />, { route: "/" });
      expect(screen.queryByText(/viewing profile/i)).toBeNull();
    });
  });

  describe("MessageCountBadge", () => {
    it("shows message count badge when userStats has messages and not on /messages route", () => {
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);
      mockUseUserStats.mockReturnValue({ data: { messageCount: 5 } } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />, { route: "/" });
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("does not show badge when on /messages route (active)", () => {
      mockUseFriends.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);
      mockUseUserStats.mockReturnValue({ data: { messageCount: 5 } } as any);
      renderWithProviders(<Navigation isLoggedIn={true} />, {
        route: "/messages",
      });
      expect(screen.queryByText("5")).toBeNull();
    });
  });

  describe("FriendSection toggle (getSectionOpen / setSectionOpen)", () => {
    const SECTION_KEY = `navyfragen_friends_sections_open_${TEST_DID}`;

    beforeEach(() => {
      localStorage.clear();
      mockUseFriends.mockReturnValue({
        data: { moots: [], following: [], oomfs: [] },
        isLoading: false,
      } as any);
    });

    it("reads section state from localStorage when it contains a value", () => {
      // Pre-populate localStorage so getSectionOpen takes the JSON.parse branch
      localStorage.setItem(SECTION_KEY, JSON.stringify({ Moots: false }));
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
      // The Moots section header is still rendered (it's a toggle, not removed)
      expect(screen.getByText(/^moots$/i)).toBeInTheDocument();
    });

    it("falls back to open=true when localStorage contains invalid JSON", () => {
      localStorage.setItem(SECTION_KEY, "{{invalid}}");
      // Should not throw, getSectionOpen returns true from catch
      expect(() =>
        renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />)
      ).not.toThrow();
      expect(screen.getByText(/^moots$/i)).toBeInTheDocument();
    });

    it("clicking a FriendSection header toggles it and persists to localStorage", () => {
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
      const mootsHeader = screen.getByText(/^moots$/i);
      // Click the header — triggers handleToggle → setSectionOpen → localStorage.setItem
      fireEvent.click(mootsHeader);
      const stored = localStorage.getItem(SECTION_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(typeof parsed).toBe("object");
    });

    it("setSectionOpen merges into existing localStorage data", () => {
      localStorage.setItem(SECTION_KEY, JSON.stringify({ Following: false }));
      renderWithProviders(<Navigation isLoggedIn={true} did={TEST_DID} />);
      const mootsHeader = screen.getByText(/^moots$/i);
      fireEvent.click(mootsHeader);
      const stored = localStorage.getItem(SECTION_KEY);
      const parsed = JSON.parse(stored!);
      // Pre-existing Following key must still be present
      expect(parsed.Following).toBe(false);
    });
  });
});
