import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import * as profileService from "../../api/profileService";
import * as settingsService from "../../api/settingsService";
import * as installPromptContext from "../../components/InstallPromptContext";
import Settings from "../../pages/Settings";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useSession: vi.fn() };
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
    mockUseBotFollow.mockReturnValue({ data: undefined, isLoading: false } as any);
  });

  it("shows auth error when user is not logged in", () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() } as any);
    mockUseUserStats.mockReturnValue({ data: undefined, isLoading: false } as any);
    mockUsePdsInfo.mockReturnValue({ data: undefined, isLoading: false } as any);
    renderWithProviders(<Settings />);
    expect(screen.getByText(/cannot access this page without logging in/i)).toBeInTheDocument();
  });

  it("shows skeleton placeholders while stats are loading", () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() } as any);
    mockUseUserStats.mockReturnValue({ data: undefined, isLoading: true } as any);
    mockUsePdsInfo.mockReturnValue({ data: undefined, isLoading: true } as any);
    renderWithProviders(<Settings />);
    expect(screen.getByText(/account overview/i)).toBeInTheDocument();
    // Stats values not visible while loading
    expect(screen.queryByText("Messages in inbox")).toBeNull();
  });

  it("renders all four account overview stats when data is loaded", () => {
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({ data: { pdsSyncEnabled: 1, imageTheme: "default" }, isLoading: false, error: null, refetch: vi.fn() } as any);
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
    mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() } as any);
    mockUseUserStats.mockReturnValue({ data: undefined, isLoading: false } as any);
    mockUsePdsInfo.mockReturnValue({ data: undefined, isLoading: false } as any);
    renderWithProviders(<Settings />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it("calls updateSettings when the PDS sync switch is toggled", async () => {
    const mockMutate = vi.fn();
    mockUseUpdateUserSettings.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
    setupLoggedIn();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: 1, imageTheme: "default" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseUserStats.mockReturnValue({ data: { messageCount: 0, memberSince: null }, isLoading: false } as any);
    mockUsePdsInfo.mockReturnValue({ data: { recordCount: 0, pdsUrl: null }, isLoading: false } as any);
    renderWithProviders(<Settings />);

    // Mantine Switch renders as a labelled checkbox input
    fireEvent.click(screen.getByLabelText(/enable pds sync/i));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ pdsSyncEnabled: false })
      );
    });
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
    mockUseUserStats.mockReturnValue({ data: { messageCount: 0, memberSince: null }, isLoading: false } as any);
    mockUsePdsInfo.mockReturnValue({ data: { recordCount: 0, pdsUrl: null }, isLoading: false } as any);
    renderWithProviders(<Settings />);

    act(() => { capturedOnError?.({ error: "Server unavailable" }); });

    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      expect(screen.getByText(/server unavailable/i)).toBeInTheDocument();
    });
  });
});
