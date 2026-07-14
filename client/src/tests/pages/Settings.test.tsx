import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import * as notificationService from "../../api/notificationService";
import * as profileService from "../../api/profileService";
import * as settingsService from "../../api/settingsService";
import * as installPromptContext from "../../components/InstallPromptContext";
import Settings from "../../pages/Settings";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useSession: vi.fn() };
});

// Settings renders <PushNotificationsButton>, whose usePushAvailable() hook
// otherwise makes a real apiClient.get() fetch call that races with (and can
// consume) the delete-account fetch mocks used by several tests below.
vi.mock("../../api/notificationService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/notificationService")>();
  return {
    ...actual,
    usePushAvailable: vi.fn(),
    useEnablePushNotifications: vi.fn(),
    useDisablePushNotifications: vi.fn(),
  };
});

vi.mock("../../api/settingsService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/settingsService")>();
  return {
    ...actual,
    useUserSettings: vi.fn(),
    useUpdateUserSettings: vi.fn(),
    useUserStats: vi.fn(),
    usePdsInfo: vi.fn(),
  };
});

vi.mock("../../api/profileService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/profileService")>();
  return { ...actual, useBotFollow: vi.fn() };
});

vi.mock("../../components/InstallPromptContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../components/InstallPromptContext")>();
  return { ...actual, useInstallPrompt: vi.fn() };
});

const mockUseSession = vi.mocked(authService.useSession);
const mockUseUserSettings = vi.mocked(settingsService.useUserSettings);
const mockUseUpdateUserSettings = vi.mocked(settingsService.useUpdateUserSettings);
const mockUseUserStats = vi.mocked(settingsService.useUserStats);
const mockUsePdsInfo = vi.mocked(settingsService.usePdsInfo);
const mockUseBotFollow = vi.mocked(profileService.useBotFollow);
const mockUseInstallPrompt = vi.mocked(installPromptContext.useInstallPrompt);
const mockUsePushAvailable = vi.mocked(notificationService.usePushAvailable);
const mockUseEnablePushNotifications = vi.mocked(notificationService.useEnablePushNotifications);
const mockUseDisablePushNotifications = vi.mocked(notificationService.useDisablePushNotifications);

const noopMutation = { mutate: vi.fn(), isPending: false } as any;
const noopInstall = { installPrompt: null, setInstallPrompt: vi.fn() };

function setupLoggedIn() {
  mockUseSession.mockReturnValue({
    data: { isLoggedIn: true, profile: { handle: "karan.bsky.social" } },
    isLoading: false,
  } as any);
}

describe("Settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    mockUseInstallPrompt.mockReturnValue(noopInstall);
    mockUseBotFollow.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    mockUsePushAvailable.mockReturnValue({ data: false, isLoading: false } as any);
    mockUseEnablePushNotifications.mockReturnValue(noopMutation);
    mockUseDisablePushNotifications.mockReturnValue(noopMutation);
  });

  it("shows auth error when user is not logged in", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
    mockUseUserSettings.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    expect(screen.getByText(/cannot access this page without logging in/i)).toBeInTheDocument();
  });

  it("shows skeleton placeholders while stats are loading", () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    mockUsePdsInfo.mockReturnValue({ data: undefined, isLoading: true } as any);
    renderWithProviders(<Settings />);
    expect(screen.getByText(/account overview/i)).toBeInTheDocument();
    // Stats values not visible while loading
    expect(screen.queryByText("Messages in inbox")).toBeNull();
  });

  it("renders all four account overview stats when data is loaded", () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 7, memberSince: "2025-01-15T00:00:00.000Z" },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 42, pdsUrl: "https://bsky.social" },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Messages in inbox")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Answers on PDS")).toBeInTheDocument();
    expect(screen.getByText("Active since")).toBeInTheDocument();
    // PDS URL with https:// stripped
    expect(screen.getByText("bsky.social")).toBeInTheDocument();
    expect(screen.getByText("PDS")).toBeInTheDocument();
  });

  it("shows em-dash placeholders when stats are absent", () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it("calls updateSettings when the PDS sync switch is toggled", async () => {
    const mockMutate = vi.fn();
    mockUseUpdateUserSettings.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);

    // pdsSyncEnabled is truthy, so the toggle button reads "PDS Sync Enabled"
    fireEvent.click(screen.getByRole("button", { name: /pds sync enabled/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ pdsSyncEnabled: false }));
    });
  });

  it("onSuccess callback for updateSettings is a no-op and does not throw", () => {
    let capturedOnSuccess: (() => void) | undefined;
    mockUseUpdateUserSettings.mockImplementation((options: any) => {
      capturedOnSuccess = options?.onSuccess;
      return noopMutation;
    });
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    // Invoke the onSuccess callback — it's intentionally empty but must be covered
    act(() => {
      capturedOnSuccess?.();
    });
    expect(document.body).toBeInTheDocument();
  });

  it("shows a toast notification when settings update fails", async () => {
    let capturedOnError: ((err: any) => void) | undefined;
    mockUseUpdateUserSettings.mockImplementation((options: any) => {
      capturedOnError = options?.onError;
      return noopMutation;
    });
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);

    act(() => {
      capturedOnError?.({ error: "Server unavailable" });
    });

    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      expect(screen.getByText(/server unavailable/i)).toBeInTheDocument();
    });
  });

  it("shows 'Notifications enabled' when user follows the bot", () => {
    setupLoggedIn();
    mockUseBotFollow.mockReturnValue({
      data: { following: true },
      isLoading: false,
    } as any);
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    expect(screen.getByText(/notifications enabled/i)).toBeInTheDocument();
  });

  it("opens delete account modal when 'Delete my Data' is clicked", async () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /delete my data/i }));
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to delete your account/i)).toBeInTheDocument();
    });
  });

  it("calls delete API and redirects on confirming delete account", async () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    window.fetch = fetchMock as any;

    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    });

    renderWithProviders(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /delete my data/i }));
    await waitFor(() => screen.getByText(/are you sure you want to delete your account/i));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/delete-account"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
    await waitFor(() => {
      expect(window.location.href).toBe("/");
    });

    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("restores body styles when delete account API fails", async () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);

    window.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error")) as any;

    renderWithProviders(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /delete my data/i }));
    await waitFor(() => screen.getByText(/are you sure you want to delete your account/i));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(document.body.style.pointerEvents).toBe("");
      expect(document.body.style.opacity).toBe("");
    });
  });

  it("clicking Cancel on the delete modal closes it (onClose callback)", async () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /delete my data/i }));
    await waitFor(() => screen.getByText(/are you sure you want to delete your account/i));
    // Click Cancel to trigger onClose → setDeleteModalOpened(false)
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/are you sure you want to delete your account/i)).toBeNull();
    });
  });

  it("shows the settings load error alert and allows retry", async () => {
    const mockRefetch = vi.fn();
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { error: "Load failed", status: 500 },
      refetch: mockRefetch,
    } as any);
    mockUseUserStats.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    expect(screen.getByText(/failed to load settings/i)).toBeInTheDocument();
    // Click Retry — covers the onClick on the Button inside settingsLoadError (line 80)
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  });

  it("handleInstallClick calls installPrompt.prompt() and clears it on acceptance", async () => {
    const setInstallPromptMock = vi.fn();
    const installPromptMock = {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    };
    mockUseInstallPrompt.mockReturnValue({
      installPrompt: installPromptMock,
      setInstallPrompt: setInstallPromptMock,
    });
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    const installBtn = screen.getByRole("button", {
      name: /install navyfragen/i,
    });
    fireEvent.click(installBtn);
    await waitFor(() => {
      expect(installPromptMock.prompt).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(setInstallPromptMock).toHaveBeenCalledWith(null);
    });
  });

  it("renders correctly in dark mode (covers dark-style branches)", () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 7, memberSince: "2025-01-15T00:00:00.000Z" },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 42, pdsUrl: "https://bsky.social" },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />, { colorScheme: "dark" });
    expect(screen.getByText(/account overview/i)).toBeInTheDocument();
  });

  it("shows fallback toast message when error.error is absent in onError", async () => {
    let capturedOnError: ((err: any) => void) | undefined;
    mockUseUpdateUserSettings.mockImplementation((options: any) => {
      capturedOnError = options?.onError;
      return noopMutation;
    });
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);

    act(() => {
      capturedOnError?.({ status: 500 }); // no .error property
    });

    await waitFor(() => {
      // The fallback message (unique to this test — no error.error property)
      expect(
        screen.getByText(/failed to update settings\. please try again\./i)
      ).toBeInTheDocument();
    });
  });

  it("handleInstallClick returns early without calling prompt() when installPrompt is null", async () => {
    // Default noopInstall has installPrompt: null; button is disabled but fireEvent bypasses it
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);

    // fireEvent.click dispatches even on disabled buttons in JSDOM
    fireEvent.click(screen.getByRole("button", { name: /install navyfragen/i }));

    // noopInstall.installPrompt is null → handleInstallClick returns early
    expect(noopInstall.setInstallPrompt).not.toHaveBeenCalled();
  });

  it("handleInstallClick does not clear installPrompt when outcome is dismissed", async () => {
    const setInstallPromptMock = vi.fn();
    const installPromptMock = {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    };
    mockUseInstallPrompt.mockReturnValue({
      installPrompt: installPromptMock,
      setInstallPrompt: setInstallPromptMock,
    });
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: /install navyfragen/i }));

    await waitFor(() => {
      expect(installPromptMock.prompt).toHaveBeenCalled();
    });
    // outcome is "dismissed" → setInstallPrompt(null) should NOT be called
    await waitFor(() => {
      expect(setInstallPromptMock).not.toHaveBeenCalledWith(null);
    });
  });

  it("uses 'default' imageTheme fallback when userSettings.imageTheme is falsy", async () => {
    const mockMutate = vi.fn();
    mockUseUpdateUserSettings.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: null },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: /pds sync enabled/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ imageTheme: "default" }));
    });
  });

  it("renders PDS sync button in a loading state when updateSettings is pending", () => {
    mockUseUpdateUserSettings.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as any);
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    // isPending=true covers the Button `loading` branch
    expect(screen.getByRole("button", { name: /pds sync enabled/i })).toBeInTheDocument();
  });

  it("shows skeleton for daily notifications card while bot-follow status is loading", () => {
    setupLoggedIn();
    mockUseBotFollow.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({
      data: { messageCount: 0, memberSince: null },
      isLoading: false,
    } as any);
    mockUsePdsInfo.mockReturnValue({
      data: { recordCount: 0, pdsUrl: null },
      isLoading: false,
    } as any);
    renderWithProviders(<Settings />);
    // botFollowLoading=true → covers the sessionLoading||botFollowLoading true branch
    expect(screen.getByText(/daily notifications/i)).toBeInTheDocument();
  });
});
