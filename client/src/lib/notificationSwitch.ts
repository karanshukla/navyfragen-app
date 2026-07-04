// Query params the service worker attaches to a notification's target URL
// (see client/public/sw.js) so the page, not the service worker, performs the
// actual account switch. The service worker has no reliable way to know the
// app's API base path (VITE_API_URL isn't available in a plain public script),
// so it just passes the recipient account through and lets already-configured
// client code make the request.
const NOTIFY_DID_PARAM = "notifyDid";
const NOTIFY_HANDLE_PARAM = "notifyHandle";

export interface NotificationSwitchRequest {
  did: string;
  handle?: string;
}

/**
 * Reads and strips the notify params from the current URL, returning the
 * requested account switch (if any). Call once on app mount, before routing
 * reads the URL for anything else.
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
