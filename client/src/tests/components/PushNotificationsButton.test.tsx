import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as notificationService from "../../api/notificationService";
import { PushNotificationsButton } from "../../components/PushNotificationsButton";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/notificationService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/notificationService")>();
  return {
    ...actual,
    getPushPermission: vi.fn(),
    usePushAvailable: vi.fn(),
    useEnablePushNotifications: vi.fn(),
    useDisablePushNotifications: vi.fn(),
  };
});

const mockGetPushPermission = vi.mocked(notificationService.getPushPermission);
const mockUsePushAvailable = vi.mocked(notificationService.usePushAvailable);
const mockUseEnablePushNotifications = vi.mocked(notificationService.useEnablePushNotifications);
const mockUseDisablePushNotifications = vi.mocked(notificationService.useDisablePushNotifications);

const SUBSCRIBED_FLAG = "nf-push-subscribed";

// Renders as a plain <button>, mirroring the rest of the settings actions.
const toggleButton = (name: RegExp) => screen.getByRole("button", { name });

describe("PushNotificationsButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUsePushAvailable.mockReturnValue({ data: true, isLoading: false } as any);
    mockUseEnablePushNotifications.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue("endpoint"),
      isPending: false,
    } as any);
    mockUseDisablePushNotifications.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    } as any);
  });

  it("shows a loader while availability is being checked", () => {
    mockUsePushAvailable.mockReturnValue({ data: undefined, isLoading: true } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsButton />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a disabled button when the server does not support push", () => {
    mockUsePushAvailable.mockReturnValue({ data: false, isLoading: false } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsButton />);
    expect(toggleButton(/push notifications unavailable/i)).toBeDisabled();
  });

  it("renders a disabled button when the browser is unsupported", () => {
    mockGetPushPermission.mockReturnValue("unsupported");
    renderWithProviders(<PushNotificationsButton />);
    expect(toggleButton(/push notifications unavailable/i)).toBeDisabled();
  });

  it("renders a disabled button when permission was denied", () => {
    mockGetPushPermission.mockReturnValue("denied");
    renderWithProviders(<PushNotificationsButton />);
    expect(toggleButton(/push notifications unavailable/i)).toBeDisabled();
  });

  it("renders an Enable button when not subscribed", () => {
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsButton />);
    expect(toggleButton(/enable push notifications/i)).not.toBeDisabled();
  });

  it("renders an Enabled button when subscribed and permission is granted", () => {
    localStorage.setItem(SUBSCRIBED_FLAG, "1");
    mockGetPushPermission.mockReturnValue("granted");
    renderWithProviders(<PushNotificationsButton />);
    expect(toggleButton(/push notifications enabled/i)).toBeInTheDocument();
  });

  it("enables push notifications on toggle and persists the subscribed flag", async () => {
    const mutateAsync = vi.fn().mockResolvedValue("endpoint");
    mockUseEnablePushNotifications.mockReturnValue({ mutateAsync, isPending: false } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsButton />);
    fireEvent.click(toggleButton(/enable push notifications/i));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem(SUBSCRIBED_FLAG)).toBe("1"));
  });

  it("disables push notifications on toggle and clears the subscribed flag", async () => {
    localStorage.setItem(SUBSCRIBED_FLAG, "1");
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseDisablePushNotifications.mockReturnValue({ mutateAsync, isPending: false } as any);
    mockGetPushPermission.mockReturnValue("granted");
    renderWithProviders(<PushNotificationsButton />);
    fireEvent.click(toggleButton(/push notifications enabled/i));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem(SUBSCRIBED_FLAG)).toBeNull());
  });

  it("shows an error notification when enabling push fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue({ error: "Boom" });
    mockUseEnablePushNotifications.mockReturnValue({ mutateAsync, isPending: false } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsButton />);
    fireEvent.click(toggleButton(/enable push notifications/i));
    await waitFor(() => expect(screen.getByText("Boom")).toBeInTheDocument());
  });

  it("shows a fallback error message when the rejection has no error string", async () => {
    const mutateAsync = vi.fn().mockRejectedValue({});
    mockUseEnablePushNotifications.mockReturnValue({ mutateAsync, isPending: false } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsButton />);
    fireEvent.click(toggleButton(/enable push notifications/i));
    await waitFor(() =>
      expect(screen.getByText(/something went wrong. please try again/i)).toBeInTheDocument()
    );
  });
});
