import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { apiClient } from "../api/apiClient";
import {
  getPushPermission,
  usePushAvailable,
  useEnablePushNotifications,
  useDisablePushNotifications,
} from "../api/notificationService";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return Wrapper;
}

vi.mock("../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const VAPID_KEY = "BEXAMPLE_VAPID-KEY_123";

describe("getPushPermission", () => {
  const originalNotification = (window as any).Notification;

  afterEach(() => {
    (window as any).Notification = originalNotification;
  });

  it("returns 'unsupported' when Notification is not in window", () => {
    delete (window as any).Notification;
    expect(getPushPermission()).toBe("unsupported");
  });

  it("returns the current Notification.permission", () => {
    (window as any).Notification = { permission: "granted" };
    expect(getPushPermission()).toBe("granted");
  });
});

describe("usePushAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the vapid key is available", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ vapidPublicKey: VAPID_KEY });
    const { result } = renderHook(() => usePushAvailable(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
  });

  it("returns false when apiClient throws a 501 (push not configured server-side)", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce({ status: 501 });
    const { result } = renderHook(() => usePushAvailable(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(false);
  });

  it("rejects when apiClient throws a non-501 error", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce({ status: 500 });
    const { result } = renderHook(() => usePushAvailable(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useEnablePushNotifications", () => {
  const originalNotification = (window as any).Notification;
  const originalServiceWorker = (navigator as any).serviceWorker;
  const originalPushManager = (window as any).PushManager;

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).PushManager = class {};
  });

  afterEach(() => {
    (window as any).Notification = originalNotification;
    (window as any).PushManager = originalPushManager;
    delete (navigator as any).serviceWorker;
    if (originalServiceWorker !== undefined) {
      Object.defineProperty(navigator, "serviceWorker", {
        value: originalServiceWorker,
        configurable: true,
      });
    }
  });

  it("throws when the server does not support push (no vapid key)", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ vapidPublicKey: null });
    const { result } = renderHook(() => useEnablePushNotifications(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({
        error: "Push notifications are not available on this server",
        status: 501,
      });
    });
  });

  it("throws when the browser does not support service workers/push manager", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ vapidPublicKey: VAPID_KEY });
    delete (navigator as any).serviceWorker;
    const { result } = renderHook(() => useEnablePushNotifications(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({
        error: "Push notifications are not supported by this browser",
        status: 501,
      });
    });
  });

  it("throws when notification permission is not granted", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ vapidPublicKey: VAPID_KEY });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve({}) },
      configurable: true,
    });
    (window as any).Notification = { requestPermission: vi.fn().mockResolvedValue("denied") };
    const { result } = renderHook(() => useEnablePushNotifications(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({
        error: "Notification permission was not granted",
        status: 403,
      });
    });
  });

  it("throws when the subscription has no endpoint", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ vapidPublicKey: VAPID_KEY });
    (window as any).Notification = { requestPermission: vi.fn().mockResolvedValue("granted") };
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            subscribe: vi.fn().mockResolvedValue({
              toJSON: () => ({ endpoint: undefined, keys: undefined }),
            }),
          },
        }),
      },
      configurable: true,
    });
    const { result } = renderHook(() => useEnablePushNotifications(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({
        error: "Push subscription returned no endpoint",
        status: 502,
      });
    });
  });

  it("subscribes successfully and posts subscription details to the server", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ vapidPublicKey: VAPID_KEY });
    vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);
    (window as any).Notification = { requestPermission: vi.fn().mockResolvedValue("granted") };
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            subscribe: vi.fn().mockResolvedValue({
              toJSON: () => ({
                endpoint: "https://push.example.com/abc",
                keys: { p256dh: "p256dh-key", auth: "auth-key" },
              }),
            }),
          },
        }),
      },
      configurable: true,
    });
    const { result } = renderHook(() => useEnablePushNotifications(), {
      wrapper: makeWrapper(),
    });
    let endpoint: string | undefined;
    await act(async () => {
      endpoint = await result.current.mutateAsync();
    });
    expect(endpoint).toBe("https://push.example.com/abc");
    expect(apiClient.post).toHaveBeenCalledWith("/notifications/subscribe", {
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });
  });
});

describe("useDisablePushNotifications", () => {
  const originalServiceWorker = (navigator as any).serviceWorker;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (navigator as any).serviceWorker;
    if (originalServiceWorker !== undefined) {
      Object.defineProperty(navigator, "serviceWorker", {
        value: originalServiceWorker,
        configurable: true,
      });
    }
  });

  it("does nothing when the browser has no service worker support", async () => {
    delete (navigator as any).serviceWorker;
    const { result } = renderHook(() => useDisablePushNotifications(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it("does nothing when there is no existing subscription", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
      },
      configurable: true,
    });
    const { result } = renderHook(() => useDisablePushNotifications(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it("unsubscribes and notifies the server when a subscription exists", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue({
              endpoint: "https://push.example.com/xyz",
              unsubscribe,
            }),
          },
        }),
      },
      configurable: true,
    });
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDisablePushNotifications(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(unsubscribe).toHaveBeenCalled();
    expect(apiClient.delete).toHaveBeenCalledWith("/notifications/subscribe", {
      endpoint: "https://push.example.com/xyz",
    });
  });
});
