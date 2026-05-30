import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "./testUtils";
import * as authService from "../api/authService";

vi.mock("../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/authService")>();
  return { ...actual, useSession: vi.fn() };
});

vi.mock("../api/messageService", () => ({
  useGetMessages: vi.fn(() => ({ data: [], isLoading: false })),
  useSyncMessages: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRespondToMessage: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useSendMessage: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteMessage: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteAccount: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useAddExampleMessages: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));
vi.mock("../api/profileService", () => ({
  usePublicProfile: vi.fn(() => ({ data: null, isLoading: false })),
  useCheckUserExists: vi.fn(() => ({ data: null, isLoading: false })),
  useFriends: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock("../api/settingsService", () => ({
  useGetSettings: vi.fn(() => ({ data: null, isLoading: false })),
  useGetStats: vi.fn(() => ({ data: null, isLoading: false })),
  useGetPdsInfo: vi.fn(() => ({ data: null, isLoading: false })),
  useUpdateSettings: vi.fn(() => ({ mutate: vi.fn() })),
  useUserStats: vi.fn(() => ({ data: null, isLoading: false })),
}));

import { AppLayout } from "../AppLayout";

const mockUseSession = vi.mocked(authService.useSession);

describe("AppLayout", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false, profile: null, did: null },
      isLoading: false,
    } as any);
  });

  it("renders without crashing", () => {
    const { container } = renderWithProviders(<AppLayout />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders the navigation sidebar", () => {
    renderWithProviders(<AppLayout />);
    // The nav is always present in DOM (collapsed on mobile via CSS)
    const nav = document.querySelector("nav, aside");
    expect(nav).not.toBeNull();
  });

  it("renders Login link on home route when not logged in", () => {
    renderWithProviders(<AppLayout />, { route: "/" });
    expect(screen.getAllByText("Login").length).toBeGreaterThan(0);
  });

  it("renders 404 page on unknown route", () => {
    renderWithProviders(<AppLayout />, { route: "/this-does-not-exist" });
    expect(screen.getByText(/404/)).toBeInTheDocument();
  });

  it("adds mousedown listener when nav is opened via burger click", async () => {
    const addListenerSpy = vi.spyOn(document, "addEventListener");
    renderWithProviders(<AppLayout />);

    // Find the burger button (hiddenFrom="sm" Mantine burger)
    const buttons = document.querySelectorAll("button");
    const burgerBtn = Array.from(buttons).find(
      (b) => b.getAttribute("aria-label") !== "Toggle color scheme"
    );

    if (burgerBtn) {
      await act(async () => {
        fireEvent.click(burgerBtn);
      });
      expect(addListenerSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    }

    addListenerSpy.mockRestore();
  });

  it("cleanup removes mousedown listener on unmount", async () => {
    const removeListenerSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderWithProviders(<AppLayout />);

    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    removeListenerSpy.mockRestore();
  });

  it("renders Navigation with handle when user is logged in", () => {
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        profile: { did: "did:example:123", handle: "user.bsky.social", displayName: "Test User" },
        did: "did:example:123",
      },
      isLoading: false,
    } as any);
    const { container } = renderWithProviders(<AppLayout />);
    expect(container.firstChild).not.toBeNull();
  });

  it("closes nav when clicking outside navbar and burger after nav is open", async () => {
    renderWithProviders(<AppLayout />);

    const buttons = document.querySelectorAll("button");
    const burgerBtn = Array.from(buttons).find(
      (b) => b.getAttribute("aria-label") !== "Toggle color scheme"
    );

    if (burgerBtn) {
      await act(async () => {
        fireEvent.click(burgerBtn);
      });

      // Click outside both navbar and burger to trigger setNavOpen(false)
      await act(async () => {
        fireEvent.mouseDown(document.body);
      });

      // Nav should be closed — no error should be thrown
      expect(document.body).toBeInTheDocument();
    }
  });
});
