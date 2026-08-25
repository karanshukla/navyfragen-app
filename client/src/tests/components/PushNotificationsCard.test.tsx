import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as notificationService from "../../api/notificationService";
import { PushNotificationsCard } from "../../components/PushNotificationsCard";
import { en } from "../../lib/i18n/en";
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

const pushSwitch = () => screen.getByRole("switch", { name: /push notifications/i });

describe("PushNotificationsCard", () => {
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

  it("shows a placeholder instead of the switch while availability is being checked", () => {
    mockUsePushAvailable.mockReturnValue({ data: undefined, isLoading: true } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsCard />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("disables the switch and says why when the server does not support push", () => {
    mockUsePushAvailable.mockReturnValue({ data: false, isLoading: false } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsCard />);
    expect(pushSwitch()).toBeDisabled();
    expect(screen.getByText(/not configured on this server/i)).toBeInTheDocument();
  });

  it("disables the switch and says why when the browser is unsupported", () => {
    mockGetPushPermission.mockReturnValue("unsupported");
    renderWithProviders(<PushNotificationsCard />);
    expect(pushSwitch()).toBeDisabled();
    expect(screen.getByText(/browser cannot receive push/i)).toBeInTheDocument();
  });

  it("disables the switch and says why when permission was denied", () => {
    mockGetPushPermission.mockReturnValue("denied");
    renderWithProviders(<PushNotificationsCard />);
    expect(pushSwitch()).toBeDisabled();
    expect(screen.getByText(/blocked in your browser settings/i)).toBeInTheDocument();
  });

  it("renders an enabled, unchecked switch when not subscribed", () => {
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsCard />);
    expect(pushSwitch()).not.toBeDisabled();
    expect(pushSwitch()).not.toBeChecked();
  });

  it("renders a checked switch when subscribed and permission is granted", () => {
    localStorage.setItem(SUBSCRIBED_FLAG, "1");
    mockGetPushPermission.mockReturnValue("granted");
    renderWithProviders(<PushNotificationsCard />);
    expect(pushSwitch()).toBeChecked();
  });

  it("disables the switch while a subscription change is in flight", () => {
    mockUseEnablePushNotifications.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsCard />);
    expect(pushSwitch()).toBeDisabled();
  });

  it("enables push notifications on toggle and persists the subscribed flag", async () => {
    const mutateAsync = vi.fn().mockResolvedValue("endpoint");
    mockUseEnablePushNotifications.mockReturnValue({ mutateAsync, isPending: false } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsCard />);
    fireEvent.click(pushSwitch());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem(SUBSCRIBED_FLAG)).toBe("1"));
  });

  it("disables push notifications on toggle and clears the subscribed flag", async () => {
    localStorage.setItem(SUBSCRIBED_FLAG, "1");
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseDisablePushNotifications.mockReturnValue({ mutateAsync, isPending: false } as any);
    mockGetPushPermission.mockReturnValue("granted");
    renderWithProviders(<PushNotificationsCard />);
    fireEvent.click(pushSwitch());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem(SUBSCRIBED_FLAG)).toBeNull());
  });

  it("shows an error notification when enabling push fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue({
      error: "PUSH_SUBSCRIBE_FAILED",
      message: "Failed to save subscription",
    });
    mockUseEnablePushNotifications.mockReturnValue({ mutateAsync, isPending: false } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsCard />);
    fireEvent.click(pushSwitch());
    await waitFor(() =>
      expect(screen.getByText(en.errors.codes.PUSH_SUBSCRIBE_FAILED)).toBeInTheDocument()
    );
  });

  it("shows a fallback error message when the rejection has no error string", async () => {
    const mutateAsync = vi.fn().mockRejectedValue({});
    mockUseEnablePushNotifications.mockReturnValue({ mutateAsync, isPending: false } as any);
    mockGetPushPermission.mockReturnValue("default");
    renderWithProviders(<PushNotificationsCard />);
    fireEvent.click(pushSwitch());
    await waitFor(() =>
      expect(screen.getByText(/something went wrong. please try again/i)).toBeInTheDocument()
    );
  });
});
