import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient, ApiError } from "./apiClient";

// Push permission is a Notification API / browser concept, not server state,
// so it's tracked locally rather than via React Query.
export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function getPushPermission(): PushPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PushPermission;
}

// --- Server API ---

const VAPID_KEY_ENDPOINT = "/notifications/vapid-public-key";

async function fetchVapidPublicKey(): Promise<string | null> {
  // A 501 means the server has no VAPID keys configured — push is unavailable.
  try {
    const res = await apiClient.get<{ vapidPublicKey: string }>(VAPID_KEY_ENDPOINT);
    return res.vapidPublicKey;
  } catch (err) {
    const status = (err as ApiError)?.status;
    if (status === 501) return null;
    throw err;
  }
}

// VAPID public keys from the server are base64url; the Push API needs them as
// a Uint8Array (applicationServerKey). This converts a base64url string.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // Allocate a concrete ArrayBuffer (not SharedArrayBuffer) so the typed array
  // satisfies the DOM's BufferSource / applicationServerKey contract under TS 5.7+.
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/**
 * Subscribe the browser's push manager and POST the subscription to the server.
 * Returns the stored endpoint so callers can persist it locally if desired.
 */
async function subscribeWithServer(): Promise<string> {
  const vapidPublicKey = await fetchVapidPublicKey();
  if (!vapidPublicKey) {
    throw { error: "Push notifications are not available on this server", status: 501 } as ApiError;
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw {
      error: "Push notifications are not supported by this browser",
      status: 501,
    } as ApiError;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw {
      error: "Notification permission was not granted",
      status: 403,
    } as ApiError;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  // Marshal the PushSubscription into the shape the server expects.
  const subJson = subscription.toJSON();
  await apiClient.post("/notifications/subscribe", {
    endpoint: subJson.endpoint,
    keys: {
      p256dh: subJson.keys?.p256dh,
      auth: subJson.keys?.auth,
    },
  });

  return subscription.endpoint;
}

/**
 * Look up the browser's current push subscription and ask the server to drop it.
 */
async function unsubscribeFromServer(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await apiClient.delete("/notifications/subscribe", { endpoint });
}

// --- React Query hooks ---

export const notificationKeys = {
  vapid: ["notifications", "vapid"] as const,
};

/**
 * Reports whether push is available on this server. Resolves to:
 *   - true  → server has VAPID keys configured
 *   - false → server returned 501 (push not configured)
 * The hook never throws — a failed probe just means "unavailable".
 */
export function usePushAvailable() {
  return useQuery<boolean>({
    queryKey: notificationKeys.vapid,
    queryFn: async () => (await fetchVapidPublicKey()) !== null,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

/**
 * Enable / disable push notifications for the current browser.
 * Returns mutations so the Settings UI can reflect pending state.
 */
export function useEnablePushNotifications() {
  return useMutation({
    mutationFn: subscribeWithServer,
  });
}

export function useDisablePushNotifications() {
  return useMutation({
    mutationFn: unsubscribeFromServer,
  });
}
