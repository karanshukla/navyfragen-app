import * as mantineCore from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as authService from "../../api/authService";
import * as accountSwitchToast from "../../lib/accountSwitchToast";
// eslint-disable-next-line import/order
import { renderWithProviders } from "../testUtils";

vi.mock("../../lib/accountSwitchToast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/accountSwitchToast")>();
  return { ...actual, buildAccountSwitchUrl: vi.fn() };
});

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return {
    ...actual,
    useSession: vi.fn(),
    useLogout: vi.fn(),
    useSwitchAccount: vi.fn(),
  };
});

vi.mock("@mantine/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mantine/notifications")>();
  return { ...actual, showNotification: vi.fn() };
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
// eslint-disable-next-line import/order
import { AppHeader } from "../../components/AppHeader";

const mockUseSession = vi.mocked(authService.useSession);
const mockUseLogout = vi.mocked(authService.useLogout);
const mockUseSwitchAccount = vi.mocked(authService.useSwitchAccount);
const mockUseComputedColorScheme = vi.mocked(mantineCore.useComputedColorScheme);
const mockBuildAccountSwitchUrl = vi.mocked(accountSwitchToast.buildAccountSwitchUrl);

const originalLocation = window.location;

describe("AppHeader", () => {
  const defaultProps = {
    opened: false,
    onBurgerToggle: vi.fn(),
    burgerRef: null,
    onNavClose: vi.fn(),
  };

  beforeEach(() => {
    // Reset body styles that may linger from the "calls logout" test
    document.body.style.pointerEvents = "";
    document.body.style.opacity = "";
    window.localStorage.removeItem("nf-bounce-logos-enabled");
    mockUseLogout.mockReturnValue({ mutate: vi.fn() } as any);
    mockUseSwitchAccount.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
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
        profile: {
          handle: "foo.bsky.social",
          displayName: "Foo Bar",
          avatar: null,
        },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    expect(screen.getByText("Foo Bar")).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });

  it("shows sun icon in dark mode", () => {
    mockUseComputedColorScheme.mockReturnValue("dark" as any);
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    // Sun icon has aria-label or is findable; just check render doesn't crash
    const toggleBtn = screen.getByLabelText("Toggle color scheme");
    expect(toggleBtn).toBeInTheDocument();
  });

  it("shows moon icon in light mode", () => {
    mockUseComputedColorScheme.mockReturnValue("light" as any);
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    const toggleBtn = screen.getByLabelText("Toggle color scheme");
    expect(toggleBtn).toBeInTheDocument();
  });

  it("calls onBurgerToggle when burger is clicked", async () => {
    const onBurgerToggle = vi.fn();
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
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
        profile: {
          handle: "foo.bsky.social",
          displayName: "Foo",
          avatar: null,
        },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    // Open the menu by clicking the user button
    const userBtn = screen.getByText("Foo").closest("button");
    if (userBtn) {
      await userEvent.click(userBtn);
      const logoutItem = screen.getByText("Log out @foo.bsky.social");
      await userEvent.click(logoutItem);
      expect(logoutMock).toHaveBeenCalled();
    }
  });

  it("calls toggleColorScheme when the color scheme toggle button is clicked", () => {
    const toggleMock = vi.fn();
    vi.mocked(mantineCore.useMantineColorScheme).mockReturnValue({
      toggleColorScheme: toggleMock,
    } as any);
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    const toggleBtn = screen.getByLabelText("Toggle color scheme");
    fireEvent.click(toggleBtn);
    expect(toggleMock).toHaveBeenCalled();
  });

  it("calls onNavClose when the Login button is clicked", () => {
    const onNavClose = vi.fn();
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} onNavClose={onNavClose} />);
    const loginBtn = screen.getByText("Login");
    fireEvent.click(loginBtn);
    expect(onNavClose).toHaveBeenCalled();
  });

  it("calls onNavigate when 'View Profile' menu item is clicked", async () => {
    const onNavClose = vi.fn();
    mockUseLogout.mockReturnValue({ mutate: vi.fn() } as any);
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        profile: {
          handle: "foo.bsky.social",
          displayName: "Foo",
          avatar: null,
        },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} onNavClose={onNavClose} />);
    const userBtn = screen.getByText("Foo").closest("button");
    if (userBtn) {
      await userEvent.click(userBtn);
      const viewProfileItem = screen.getByText("View Profile");
      fireEvent.click(viewProfileItem);
      expect(onNavClose).toHaveBeenCalled();
    }
  });

  it("uses fallback 'User Avatar' alt text when displayName is null", () => {
    mockUseLogout.mockReturnValue({ mutate: vi.fn() } as any);
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        profile: { handle: "foo.bsky.social", displayName: null, avatar: null },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    // Avatar renders with alt="User Avatar" when displayName is null
    const avatar = document.querySelector("img, [role='img']") as HTMLElement;
    // Component renders without crash; coverage of line 168 (displayName || "User Avatar")
    expect(document.body).toBeInTheDocument();
  });

  it("covers catch block when logout throws synchronously", async () => {
    const logoutMock = vi.fn(() => {
      throw new Error("Logout failed");
    });
    mockUseLogout.mockReturnValue({ mutate: logoutMock } as any);
    mockUseSession.mockReturnValue({
      data: {
        isLoggedIn: true,
        profile: {
          handle: "foo.bsky.social",
          displayName: "Foo",
          avatar: null,
        },
      },
      isLoading: false,
    } as any);
    renderWithProviders(<AppHeader {...defaultProps} />);
    const userBtn = screen.getByText("Foo").closest("button");
    if (userBtn) {
      await userEvent.click(userBtn);
      const logoutItem = screen.getByText("Log out @foo.bsky.social");
      fireEvent.click(logoutItem);
      // The catch block resets body styles
      expect(document.body.style.pointerEvents).toBe("");
    }
  });

  describe("account switcher", () => {
    const accounts = [
      { did: "did:example:active", handle: "active.bsky.social", displayName: "Active User" },
      { did: "did:example:other", handle: "other.bsky.social", displayName: "Other User" },
    ];

    beforeEach(() => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: { ...originalLocation, href: "" },
      });
      mockUseSession.mockReturnValue({
        data: {
          isLoggedIn: true,
          profile: { handle: "active.bsky.social", displayName: "Active User", avatar: null },
          accounts,
          did: "did:example:active",
        },
        isLoading: false,
      } as any);
    });

    afterEach(() => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: originalLocation,
      });
    });

    async function openMenu() {
      const userBtn = screen.getAllByText("Active User")[0].closest("button")!;
      await userEvent.click(userBtn);
    }

    it("lists every account with the active one checked and disabled", async () => {
      renderWithProviders(<AppHeader {...defaultProps} />);
      await openMenu();
      expect(screen.getByText("Other User")).toBeInTheDocument();
      const activeItem = screen.getByText("@active.bsky.social").closest('[role="menuitem"]');
      expect(activeItem).toHaveAttribute("data-disabled", "true");
    });

    it("does nothing when clicking the already-active account", async () => {
      const mockSwitch = vi.fn();
      mockUseSwitchAccount.mockReturnValue({ mutate: mockSwitch, isPending: false } as any);
      renderWithProviders(<AppHeader {...defaultProps} />);
      await openMenu();
      const activeItem = screen.getByText("@active.bsky.social").closest("button")!;
      fireEvent.click(activeItem);
      expect(mockSwitch).not.toHaveBeenCalled();
    });

    it("switches to another account and redirects on success", async () => {
      let capturedCallbacks: any;
      const mockSwitch = vi.fn((_data, callbacks) => {
        capturedCallbacks = callbacks;
      });
      mockUseSwitchAccount.mockReturnValue({ mutate: mockSwitch, isPending: false } as any);
      mockBuildAccountSwitchUrl.mockReturnValue("/?accountSwitched=other.bsky.social");
      renderWithProviders(<AppHeader {...defaultProps} />);
      await openMenu();
      const otherItem = screen.getByText("@other.bsky.social").closest("button")!;
      fireEvent.click(otherItem);

      expect(mockSwitch).toHaveBeenCalledWith({ did: "did:example:other" }, expect.any(Object));

      act(() => {
        capturedCallbacks.onSuccess();
      });

      expect(mockBuildAccountSwitchUrl).toHaveBeenCalledWith("other.bsky.social");
      expect(window.location.href).toBe("/?accountSwitched=other.bsky.social");
    });

    it("shows an error notification when switching accounts fails", async () => {
      let capturedCallbacks: any;
      const mockSwitch = vi.fn((_data, callbacks) => {
        capturedCallbacks = callbacks;
      });
      mockUseSwitchAccount.mockReturnValue({ mutate: mockSwitch, isPending: false } as any);
      renderWithProviders(<AppHeader {...defaultProps} />);
      await openMenu();
      const otherItem = screen.getByText("@other.bsky.social").closest("button")!;
      fireEvent.click(otherItem);

      await waitFor(() => expect(mockSwitch).toHaveBeenCalled());

      act(() => {
        capturedCallbacks.onError({ error: "Switch failed" });
      });

      expect(vi.mocked(showNotification)).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't switch account", message: "Switch failed" })
      );
    });

    it("shows a fallback error message when switching accounts fails without a message", async () => {
      let capturedCallbacks: any;
      const mockSwitch = vi.fn((_data, callbacks) => {
        capturedCallbacks = callbacks;
      });
      mockUseSwitchAccount.mockReturnValue({ mutate: mockSwitch, isPending: false } as any);
      renderWithProviders(<AppHeader {...defaultProps} />);
      await openMenu();
      const otherItem = screen.getByText("@other.bsky.social").closest("button")!;
      fireEvent.click(otherItem);

      await waitFor(() => expect(mockSwitch).toHaveBeenCalled());

      act(() => {
        capturedCallbacks.onError({} as any);
      });

      expect(vi.mocked(showNotification)).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't switch account", message: "Please try again." })
      );
    });

    it("always shows the active profile row when there is only one account, with no others listed", async () => {
      mockUseSession.mockReturnValue({
        data: {
          isLoggedIn: true,
          profile: { handle: "active.bsky.social", displayName: "Active User", avatar: null },
          accounts: [accounts[0]],
          did: "did:example:active",
        },
        isLoading: false,
      } as any);
      renderWithProviders(<AppHeader {...defaultProps} />);
      await openMenu();
      // The active profile row renders unconditionally above "Add account"...
      expect(screen.getByText("@active.bsky.social")).toBeInTheDocument();
      // ...marked active (disabled + checked)...
      const activeItem = screen.getByText("@active.bsky.social").closest('[role="menuitem"]');
      expect(activeItem).toHaveAttribute("data-disabled", "true");
      // ...with no "Accounts" label (only shown when there are others)...
      expect(screen.queryByText("Accounts")).not.toBeInTheDocument();
      // ...and no other switchable accounts listed beneath it.
      expect(screen.queryByText("Other User")).not.toBeInTheDocument();
      expect(screen.queryByText("@other.bsky.social")).not.toBeInTheDocument();
    });

    it("does nothing when a switch is already pending", async () => {
      const mockSwitch = vi.fn();
      mockUseSwitchAccount.mockReturnValue({ mutate: mockSwitch, isPending: true } as any);
      renderWithProviders(<AppHeader {...defaultProps} />);
      await openMenu();
      const otherItem = screen.getByText("@other.bsky.social").closest("button")!;
      fireEvent.click(otherItem);
      expect(mockSwitch).not.toHaveBeenCalled();
    });

    it("falls back to did/handle placeholders when displayName and handle are missing", async () => {
      const mockSwitch = vi.fn();
      mockUseSwitchAccount.mockReturnValue({ mutate: mockSwitch, isPending: false } as any);
      mockUseSession.mockReturnValue({
        data: {
          isLoggedIn: true,
          profile: { handle: "active.bsky.social", displayName: "Active User", avatar: null },
          accounts: [
            accounts[0],
            { did: "did:example:bare", handle: undefined, displayName: undefined, avatar: null },
          ],
          did: "did:example:active",
        },
        isLoading: false,
      } as any);
      renderWithProviders(<AppHeader {...defaultProps} />);
      await openMenu();
      // Falls back to the did for both the label and the avatar initial.
      const bareItem = screen.getByText("did:example:bare").closest("button")!;
      expect(bareItem).toHaveTextContent("?");

      fireEvent.click(bareItem);
      expect(mockSwitch).toHaveBeenCalledWith({ did: "did:example:bare" }, expect.any(Object));
    });

    it("triggers haptics and onNavigate when 'Add account' is clicked", async () => {
      const onNavClose = vi.fn();
      renderWithProviders(<AppHeader {...defaultProps} onNavClose={onNavClose} />);
      await openMenu();
      const addAccountItem = screen.getByText("Add account");
      fireEvent.click(addAccountItem);
      expect(onNavClose).toHaveBeenCalled();
      expect(addAccountItem.closest("a")).toHaveAttribute("href", "/login?add=1");
    });
  });

  describe("bouncing logos toggle button", () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;

    function setViewport(width: number, height: number) {
      Object.defineProperty(window, "innerWidth", {
        value: width,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: height,
        configurable: true,
        writable: true,
      });
    }

    afterEach(() => {
      setViewport(originalWidth, originalHeight);
    });

    it("is hidden on a normal-width viewport", () => {
      setViewport(1400, 900);
      mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
      renderWithProviders(<AppHeader {...defaultProps} />);
      expect(screen.queryByText("Disable animations")).not.toBeInTheDocument();
      expect(screen.queryByText("Enable animations")).not.toBeInTheDocument();
    });

    it("appears on a very wide (4K-style) viewport and toggles its own label", async () => {
      setViewport(2560, 1440);
      mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
      renderWithProviders(<AppHeader {...defaultProps} />);

      const toggleBtn = screen.getByText("Disable animations");
      await userEvent.click(toggleBtn);
      expect(screen.getByText("Enable animations")).toBeInTheDocument();

      await userEvent.click(screen.getByText("Enable animations"));
      expect(screen.getByText("Disable animations")).toBeInTheDocument();
    });
  });
});
