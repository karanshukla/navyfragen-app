// The service worker attaches these to a notification's target URL so the page
// performs the account switch: VITE_API_URL is not available to the SW bundle,
// so it cannot call the API itself.
const NOTIFY_DID_PARAM = "notifyDid";
const NOTIFY_HANDLE_PARAM = "notifyHandle";

export interface NotificationSwitchRequest {
  did: string;
  handle?: string;
}

/**
 * Call once on app mount, before routing reads the URL for anything else.
 *
 * @see [notificationSwitch.test.ts](../tests/lib/notificationSwitch.test.ts) —
 * pins that the params are both read and stripped.
 */
export function consumeNotificationSwitchRequest(): NotificationSwitchRequest | null {
  const url = new URL(window.location.href);
  const did = url.searchParams.get(NOTIFY_DID_PARAM);
  if (!did) return null;

  const handle = url.searchParams.get(NOTIFY_HANDLE_PARAM) || undefined;
  url.searchParams.delete(NOTIFY_DID_PARAM);
  url.searchParams.delete(NOTIFY_HANDLE_PARAM);
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);

  return { did, handle };
}
