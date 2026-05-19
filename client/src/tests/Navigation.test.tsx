import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { Navigation } from "../Navigation";
import * as profileServiceModule from "../api/profileService";
import type { Friend } from "../api/profileService";

vi.mock("../api/profileService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/profileService")>();
  return { ...actual, useFriends: vi.fn() };
});

const mockUseFriends = vi.mocked(profileServiceModule.useFriends);

function makeFriends(count: number): Friend[] {
  return Array.from({ length: count }, (_, i) => ({
    did: `did:example:${i}`,
    handle: `friend${i}.bsky.social`,
    displayName: i % 2 === 0 ? `Friend ${i}` : undefined,
    avatar: i % 3 === 0 ? `https://cdn.bsky.app/${i}.jpg` : undefined,
  }));
}

function renderNav(isLoggedIn = true) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <Navigation isLoggedIn={isLoggedIn} />
      </MemoryRouter>
    </MantineProvider>
  );
}

describe("Navigation — friends list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton placeholders while friends are loading", () => {
    mockUseFriends.mockReturnValue({ data: undefined, isLoading: true } as any);
    renderNav();
    expect(screen.getByText(/friends on navyfragen/i)).toBeInTheDocument();
    // No friend handles rendered during loading
    expect(screen.queryByText(/@friend\d/)).toBeNull();
  });

  it("shows empty state when user has no friends on app", () => {
    mockUseFriends.mockReturnValue({ data: { friends: [] }, isLoading: false } as any);
    renderNav();
    expect(screen.getByText(/none of the people you follow/i)).toBeInTheDocument();
  });

  it("renders all friends when count is within page size", () => {
    mockUseFriends.mockReturnValue({ data: { friends: makeFriends(5) }, isLoading: false } as any);
    renderNav();
    expect(screen.getByText("@friend0.bsky.social")).toBeInTheDocument();
    expect(screen.getByText("@friend4.bsky.social")).toBeInTheDocument();
    expect(screen.queryByText(/load more/i)).toBeNull();
    expect(screen.queryByText(/show less/i)).toBeNull();
  });

  it("shows only first 10 friends and a load more button when list exceeds page size", () => {
    mockUseFriends.mockReturnValue({ data: { friends: makeFriends(15) }, isLoading: false } as any);
    renderNav();
    expect(screen.getByText("@friend0.bsky.social")).toBeInTheDocument();
    expect(screen.queryByText("@friend10.bsky.social")).toBeNull();
    expect(screen.getByText(/load 5 more/i)).toBeInTheDocument();
    expect(screen.queryByText(/show less/i)).toBeNull();
  });

  it("reveals more friends and shows 'show less' after clicking load more", () => {
    mockUseFriends.mockReturnValue({ data: { friends: makeFriends(15) }, isLoading: false } as any);
    renderNav();

    fireEvent.click(screen.getByText(/load \d+ more/i));

    expect(screen.getByText("@friend10.bsky.social")).toBeInTheDocument();
    expect(screen.getByText("@friend14.bsky.social")).toBeInTheDocument();
    expect(screen.getByText(/show less/i)).toBeInTheDocument();
    expect(screen.queryByText(/load \d+ more/i)).toBeNull();
  });

  it("collapses back to 10 friends after clicking show less", () => {
    mockUseFriends.mockReturnValue({ data: { friends: makeFriends(15) }, isLoading: false } as any);
    renderNav();

    fireEvent.click(screen.getByText(/load \d+ more/i));
    expect(screen.getByText("@friend10.bsky.social")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/show less/i));

    expect(screen.queryByText("@friend10.bsky.social")).toBeNull();
    expect(screen.getByText("@friend0.bsky.social")).toBeInTheDocument();
    expect(screen.queryByText(/show less/i)).toBeNull();
    expect(screen.getByText(/load 5 more/i)).toBeInTheDocument();
  });

  it("load more increments by page size and updates remaining count", () => {
    mockUseFriends.mockReturnValue({ data: { friends: makeFriends(25) }, isLoading: false } as any);
    renderNav();

    expect(screen.getByText(/load 15 more/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/load \d+ more/i));
    expect(screen.getByText("@friend10.bsky.social")).toBeInTheDocument();
    expect(screen.getByText(/load 5 more/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/load \d+ more/i));
    expect(screen.getByText("@friend24.bsky.social")).toBeInTheDocument();
    expect(screen.queryByText(/load \d+ more/i)).toBeNull();
  });

  it("shows display name when available, falls back to handle as primary label", () => {
    const friends: Friend[] = [
      { did: "did:1", handle: "withname.bsky.social", displayName: "Has Name", avatar: undefined },
      { did: "did:2", handle: "noname.bsky.social", displayName: undefined, avatar: undefined },
    ];
    mockUseFriends.mockReturnValue({ data: { friends }, isLoading: false } as any);
    renderNav();

    expect(screen.getByText("Has Name")).toBeInTheDocument();
    // No displayName → handle is used as primary label
    expect(screen.getByText("noname.bsky.social")).toBeInTheDocument();
  });

  it("does not show the friends section when user is not logged in", () => {
    mockUseFriends.mockReturnValue({ data: undefined, isLoading: false } as any);
    renderNav(false);
    expect(screen.queryByText(/friends on navyfragen/i)).toBeNull();
  });
});
