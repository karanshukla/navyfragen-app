import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient, ApiError } from "./apiClient";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function getPushPermission(): PushPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PushPermission;
}

const VAPID_PUBLIC_KEY_ENDPOINT = "/notifications/vapid-public-key";

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const { vapidPublicKey } = await apiClient.get<{ vapidPublicKey: string }>(
      VAPID_PUBLIC_KEY_ENDPOINT
    );
    return vapidPublicKey;
  } catch (err) {
    if ((err as ApiError)?.status === 501) return null;
    throw err;
  }
}

function pushError(message: string, status: number): ApiError {
  return { error: message, status };
}

function base64UrlToApplicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");
  const decoded = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

async function createPushSubscription(): Promise<string> {
  const vapidPublicKey = await fetchVapidPublicKey();
  if (!vapidPublicKey) {
    throw pushError("Push notifications are not available on this server", 501);
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw pushError("Push notifications are not supported by this browser", 501);
  }

  if ((await Notification.requestPermission()) !== "granted") {
    throw pushError("Notification permission was not granted", 403);
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToApplicationServerKey(vapidPublicKey),
  });

  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint) {
    throw pushError("Push subscription returned no endpoint", 502);
  }

  await apiClient.post("/notifications/subscribe", {
    endpoint,
    keys: { p256dh: keys?.p256dh, auth: keys?.auth },
  });

  return endpoint;
}

async function cancelPushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await apiClient.delete("/notifications/subscribe", { endpoint });
}

// --- React Query hooks ---

export const notificationKeys = {
  vapid: ["notifications", "vapid"] as const,
};

export function usePushAvailable() {
  return useQuery<boolean>({
    queryKey: notificationKeys.vapid,
    queryFn: async () => (await fetchVapidPublicKey()) !== null,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export function useEnablePushNotifications() {
  return useMutation({ mutationFn: createPushSubscription });
}

export function useDisablePushNotifications() {
  return useMutation({ mutationFn: cancelPushSubscription });
}
