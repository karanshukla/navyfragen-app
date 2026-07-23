import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import * as settingsService from "../../api/settingsService";
import Customise from "../../pages/Customise";
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
  };
});

const mockUseSession = vi.mocked(authService.useSession);
const mockUseUserSettings = vi.mocked(settingsService.useUserSettings);
const mockUseUpdateUserSettings = vi.mocked(settingsService.useUpdateUserSettings);

function mockSettings(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      did: "did:example:user",
      pdsSyncEnabled: 1,
      imageTheme: "default",
      inboxEnabled: 1,
      profanityFilterEnabled: 0,
      customPrompt: null,
      profileCardTheme: null,
      touchpointLocale: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      ...overrides,
    },
    isLoading: false,
  } as any;
}

function mockMutation() {
  const mutate = vi.fn();
  mockUseUpdateUserSettings.mockReturnValue({
    mutate,
    isPending: false,
  } as any);
  return mutate;
}

describe("Customise page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: true, profile: { handle: "karan.bsky.social" } },
      isLoading: false,
    } as any);
    // Default the settings hook so the component doesn't throw on render even
    // in the logged-out test (useUserSettings is called before the auth gate).
    mockUseUserSettings.mockReturnValue(mockSettings());
    mockMutation();
  });

  it("shows auth error when user is not logged in", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
    renderWithProviders(<Customise />);
    expect(screen.getByText(/cannot access this page without logging in/i)).toBeInTheDocument();
  });

  it("renders the grouped sections and wired controls for a logged-in user", () => {
    mockUseUserSettings.mockReturnValue(mockSettings());
    mockMutation();
    renderWithProviders(<Customise />);

    expect(screen.getByRole("heading", { name: /customise/i })).toBeInTheDocument();
    // Section eyebrows
    expect(screen.getByText(/your public profile/i)).toBeInTheDocument();
    expect(screen.getByText(/message intake/i)).toBeInTheDocument();
    // Wired cards
    expect(screen.getByText(/profile prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/message language/i)).toBeInTheDocument();
    expect(screen.getByText(/profile card colour/i)).toBeInTheDocument();
    expect(screen.getByText(/^inbox$/i)).toBeInTheDocument();
    expect(screen.getByText(/profanity filter/i)).toBeInTheDocument();
    // Notifications section was removed.
    expect(screen.queryByText(/^notifications$/i)).toBeNull();
    expect(screen.queryByText(/what sends a push/i)).toBeNull();
  });

  it("toggling the inbox switch fires updateSettings with only inboxEnabled", () => {
    mockUseUserSettings.mockReturnValue(mockSettings());
    const mutate = mockMutation();
    renderWithProviders(<Customise />);

    const toggle = screen.getByLabelText(/accepting messages/i) as HTMLInputElement;
    fireEvent.click(toggle);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ inboxEnabled: false });
  });

  it("toggling the profanity filter fires updateSettings with only profanityFilterEnabled", () => {
    mockUseUserSettings.mockReturnValue(mockSettings());
    const mutate = mockMutation();
    renderWithProviders(<Customise />);

    const toggle = screen.getByLabelText(/filter enabled/i) as HTMLInputElement;
    fireEvent.click(toggle);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ profanityFilterEnabled: true });
  });

  it("picking a locale fires updateSettings with touchpointLocale", () => {
    mockUseUserSettings.mockReturnValue(mockSettings());
    const mutate = mockMutation();
    renderWithProviders(<Customise />);

    // Mantine Select renders a combobox. Query by role to avoid matching the
    // card title text, then open it and pick Español.
    const combobox = screen.getByRole("combobox", { name: /message language/i });
    fireEvent.click(combobox);
    const option = screen.getByRole("option", { name: /español/i });
    fireEvent.click(option);

    expect(mutate).toHaveBeenCalledWith({ touchpointLocale: "es" });
  });

  it("picking a profile card theme swatch fires updateSettings with profileCardTheme", () => {
    mockUseUserSettings.mockReturnValue(mockSettings());
    const mutate = mockMutation();
    renderWithProviders(<Customise />);

    fireEvent.click(screen.getByLabelText(/ember theme/i));
    expect(mutate).toHaveBeenCalledWith({ profileCardTheme: "ember" });
  });

  it("persisting a custom prompt fires updateSettings with the trimmed value", () => {
    mockUseUserSettings.mockReturnValue(mockSettings());
    const mutate = mockMutation();
    renderWithProviders(<Customise />);

    const input = screen.getByLabelText(/profile prompt/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Ask me anything" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith({ customPrompt: "Ask me anything" });
  });

  it("blurring an unchanged prompt does not fire a mutation", () => {
    mockUseUserSettings.mockReturnValue(mockSettings({ customPrompt: "existing" }));
    const mutate = mockMutation();
    renderWithProviders(<Customise />);

    const input = screen.getByLabelText(/profile prompt/i) as HTMLInputElement;
    fireEvent.blur(input); // no change

    expect(mutate).not.toHaveBeenCalled();
  });

  it("clearing the prompt persists null (revert to default)", () => {
    mockUseUserSettings.mockReturnValue(mockSettings({ customPrompt: "existing" }));
    const mutate = mockMutation();
    renderWithProviders(<Customise />);

    const input = screen.getByLabelText(/profile prompt/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith({ customPrompt: null });
  });

  it("renders correctly in dark mode", () => {
    mockUseUserSettings.mockReturnValue(mockSettings());
    mockMutation();
    renderWithProviders(<Customise />, { colorScheme: "dark" });
    expect(screen.getByRole("heading", { name: /customise/i })).toBeInTheDocument();
  });

  it("shows a retry control when settings fail to load", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mockUseUserSettings.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
      refetch,
    } as any);
    mockMutation();
    renderWithProviders(<Customise />);

    // The settings-error fallback renders inside each card, so there's a
    // retry button per card. Clicking any of them calls refetchSettings.
    const retry = screen.getAllByRole("button", { name: /^retry$/i })[0];
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
