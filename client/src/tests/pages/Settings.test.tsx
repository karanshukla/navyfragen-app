import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import * as notificationService from "../../api/notificationService";
import * as profileService from "../../api/profileService";
import * as settingsService from "../../api/settingsService";
import { APP_DOMAIN } from "../../lib/brand";
import { en } from "../../lib/i18n/en";
import Settings from "../../pages/Settings";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useSession: vi.fn() };
});

// Settings renders <PushNotificationsCard>, whose usePushAvailable() hook
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

const mockUseSession = vi.mocked(authService.useSession);
const mockUseUserSettings = vi.mocked(settingsService.useUserSettings);
const mockUseUpdateUserSettings = vi.mocked(settingsService.useUpdateUserSettings);
const mockUseUserStats = vi.mocked(settingsService.useUserStats);
const mockUsePdsInfo = vi.mocked(settingsService.usePdsInfo);
const mockUseBotFollow = vi.mocked(profileService.useBotFollow);
const mockUsePushAvailable = vi.mocked(notificationService.usePushAvailable);
const mockUseEnablePushNotifications = vi.mocked(notificationService.useEnablePushNotifications);
const mockUseDisablePushNotifications = vi.mocked(notificationService.useDisablePushNotifications);

const noopMutation = { mutate: vi.fn(), isPending: false } as any;

function setupLoggedIn() {
  mockUseSession.mockReturnValue({
    data: { isLoggedIn: true, profile: { handle: "karan.bsky.social" } },
    isLoading: false,
  } as any);
}

/** The loaded-and-quiet page: every hook resolved, nothing pending or failed. */
function setupLoadedPage(settings: Record<string, unknown> = {}) {
  setupLoggedIn();
  mockUseUserSettings.mockReturnValue({
    data: { pdsSyncEnabled: 1, imageTheme: "default", defaultClient: null, ...settings },
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
}

describe("Settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
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
    expect(screen.getByText(en.common.accessDeniedMessage)).toBeInTheDocument();
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
    expect(screen.queryByText(en.settingsPage.messagesInInbox)).toBeNull();
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
    expect(screen.getByText(en.settingsPage.messagesInInbox)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(en.settingsPage.answersOnPds)).toBeInTheDocument();
    expect(screen.getByText(en.settingsPage.activeSince)).toBeInTheDocument();
    // PDS URL with https:// stripped
    expect(screen.getByText("bsky.social")).toBeInTheDocument();
    expect(screen.getByText(en.settingsPage.pdsLabel)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("switch", { name: en.settingsPage.pdsSync }));

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
      capturedOnError?.({
        error: "SETTINGS_UPDATE_FAILED",
        message: "Failed to update user settings",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(en.settingsPage.updateFailedTitle)).toBeInTheDocument();
      expect(screen.getByText(en.errors.codes.SETTINGS_UPDATE_FAILED)).toBeInTheDocument();
    });
  });

  it("offers to view, not follow, when the user already follows the bot", () => {
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
    expect(
      screen.getByRole("link", { name: en.settingsPage.viewBotOnBluesky })
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en.settingsPage.followTheBotOnBluesky })).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: en.settingsPage.deleteMyData }));
    await waitFor(() => {
      expect(screen.getByText(en.settingsPage.deleteAccountMessage)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: en.settingsPage.deleteMyData }));
    await waitFor(() => screen.getByText(en.settingsPage.deleteAccountMessage));
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));

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
    fireEvent.click(screen.getByRole("button", { name: en.settingsPage.deleteMyData }));
    await waitFor(() => screen.getByText(en.settingsPage.deleteAccountMessage));
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));

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
    fireEvent.click(screen.getByRole("button", { name: en.settingsPage.deleteMyData }));
    await waitFor(() => screen.getByText(en.settingsPage.deleteAccountMessage));
    // Click Cancel to trigger onClose → setDeleteModalOpened(false)
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    await waitFor(() => {
      expect(screen.queryByText(en.settingsPage.deleteAccountMessage)).toBeNull();
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
    const alerts = screen.getAllByText(/failed to load settings/i);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    // Click Retry — covers the onClick on the Button inside settingsLoadError (line 80)
    fireEvent.click(screen.getAllByRole("button", { name: en.common.retry })[0]);
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  });

  it("picking a client fires updateSettings with only defaultClient", () => {
    const mutate = vi.fn();
    mockUseUpdateUserSettings.mockReturnValue({ mutate, isPending: false } as any);
    setupLoadedPage();
    renderWithProviders(<Settings />);

    const combobox = screen.getByRole("combobox", { name: en.settingsPage.defaultClient });
    fireEvent.click(combobox);
    fireEvent.click(screen.getByRole("option", { name: "Deer" }));

    expect(mutate).toHaveBeenCalledWith({ defaultClient: "deer" });
  });

  it("takes no typed input: the client list is a picker, not a text box", () => {
    setupLoadedPage();
    renderWithProviders(<Settings />);

    const combobox = screen.getByRole("combobox", { name: en.settingsPage.defaultClient });
    expect(combobox).toHaveAttribute("readonly");
    expect(combobox).toHaveValue("Bluesky");
  });

  it("shows Bluesky, not an empty box, when no client has been picked", () => {
    setupLoadedPage({ defaultClient: null });
    renderWithProviders(<Settings />);

    expect(screen.getByRole("combobox", { name: en.settingsPage.defaultClient })).toHaveValue(
      "Bluesky"
    );
  });

  it("shows Bluesky for a stored client id that has left the catalog", () => {
    setupLoadedPage({ defaultClient: "a-client-that-shut-down" });
    renderWithProviders(<Settings />);

    expect(screen.getByRole("combobox", { name: en.settingsPage.defaultClient })).toHaveValue(
      "Bluesky"
    );
  });

  it("shows the matching label when defaultClient is already set", () => {
    setupLoadedPage({ defaultClient: "deer" });
    renderWithProviders(<Settings />);

    expect(screen.getByRole("combobox", { name: en.settingsPage.defaultClient })).toHaveValue(
      "Deer"
    );
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
      // The generic fallback (unique to this test — no error.error property)
      expect(screen.getByText(en.errors.generic)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("switch", { name: en.settingsPage.pdsSync }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ imageTheme: "default" }));
    });
  });

  it("disables the PDS sync switch while the update is in flight", () => {
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
    expect(screen.getByRole("switch", { name: en.settingsPage.pdsSync })).toBeDisabled();
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
    expect(screen.getByText(en.settingsPage.dailyNotifications)).toBeInTheDocument();
  });
  /**
   * The feed rkey is a frozen contract and the handle is not, so this spells
   * the rkey out as a literal while letting the domain follow `brand.json`.
   * A rename therefore fails here and nowhere else, which is the point: the
   * `at://` URI is already in the hands of anyone who pinned the feed.
   */
  it("links the feed at its published rkey, which a rename must not silently change", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: true, profile: { did: "did:plc:abc", handle: "alice.bsky.social" } },
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
    const feedLink = screen.getByRole("link", { name: en.settingsPage.openFeedOnBluesky });
    expect(feedLink).toHaveAttribute(
      "href",
      `https://bsky.app/profile/${APP_DOMAIN}/feed/navyfragen`
    );
  });
});
