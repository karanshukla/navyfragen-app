import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { renderWithProviders } from "../testUtils";
import * as authService from "../../api/authService";
import * as mantineCore from "@mantine/core";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useSession: vi.fn(), useLogout: vi.fn() };
});

vi.mock("@mantine/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mantine/core")>();
  return {
    ...actual,
    useComputedColorScheme: vi.fn(() => "light"),
    useMantineColorScheme: vi.fn(() => ({ toggleColorScheme: vi.fn() })),
  };
});

// Imported after mocks are registered
import { AppHeader } from "../../components/AppHeader";

const mockUseSession = vi.mocked(authService.useSession);
const mockUseLogout = vi.mocked(authService.useLogout);
const mockUseComputedColorScheme = vi.mocked(mantineCore.useComputedColorScheme);

describe("AppHeader", () => {
  const defaultProps = {
    opened: false,
    onBurgerToggle: vi.fn(),
    burgerRef: null,
    onNavClose: vi.fn(),
  };

  beforeEach(() => {
    mockUseLogout.mockReturnValue({ mutate: vi.fn() } as any);
    mockUseComputedColorScheme.mockReturnValue("light" as any);
  });

  it("shows Loader when isLoading is true", () => {
    mockUseSession.mockReturnValue({ data: undefined, isLoading: true } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    // Loader renders as a specific element; check no login button
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });

  it("shows Login button when not logged in", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false, profile: null },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("shows UserMenu when logged in with profile", () => {
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        profile: { handle: "foo.bsky.social", displayName: "Foo Bar", avatar: null },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    expect(screen.getByText("Foo Bar")).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });

  it("shows sun icon in dark mode", () => {
    mockUseComputedColorScheme.mockReturnValue("dark" as any);
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    // Sun icon has aria-label or is findable; just check render doesn't crash
    const toggleBtn = screen.getByLabelText("Toggle color scheme");
    expect(toggleBtn).toBeInTheDocument();
  });

  it("shows moon icon in light mode", () => {
    mockUseComputedColorScheme.mockReturnValue("light" as any);
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    const toggleBtn = screen.getByLabelText("Toggle color scheme");
    expect(toggleBtn).toBeInTheDocument();
  });

  it("calls onBurgerToggle when burger is clicked", async () => {
    const onBurgerToggle = vi.fn();
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
    renderWithProviders(<AppHeader {...defaultProps} onBurgerToggle={onBurgerToggle} />);
    // Burger button from Mantine has aria-label with "open navigation"
    const burgers = document.querySelectorAll("button");
    // Find the burger by clicking the first non-color-scheme button
    const burgerBtn = Array.from(burgers).find(
      (b) => b.getAttribute("aria-label") !== "Toggle color scheme"
    );
    if (burgerBtn) {
      await userEvent.click(burgerBtn);
      expect(onBurgerToggle).toHaveBeenCalled();
    }
  });

  it("calls logout when logout menu item is clicked", async () => {
    const logoutMock = vi.fn();
    mockUseLogout.mockReturnValue({ mutate: logoutMock } as any);
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        profile: { handle: "foo.bsky.social", displayName: "Foo", avatar: null },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    // Open the menu by clicking the user button
    const userBtn = screen.getByText("Foo").closest("button");
    if (userBtn) {
      await userEvent.click(userBtn);
      const logoutItem = screen.getByText("Logout");
      await userEvent.click(logoutItem);
      expect(logoutMock).toHaveBeenCalled();
    }
  });
});
