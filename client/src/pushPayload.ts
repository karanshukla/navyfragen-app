/**
 * Shape of the JSON payload the server sends with a push event. All fields are
 * optional — the service worker falls back to sensible defaults for any that
 * are missing (see client/src/sw.ts).
 *
 * Shared between the service worker (sw.ts) and the server's push dispatcher
 * so the contract lives in one place. The server is expected to send a
 * superset of this shape; extra fields are ignored.
 */
export interface PushPayload {
  title?: string;
  body?: string;
  /** Path navigated to when the notification is clicked. Defaults to /messages. */
  url?: string;
  /** Recipient account DID — used by the page to switch accounts on click. */
  did?: string;
  /** Recipient account handle — shown/used alongside `did`. */
  handle?: string;
}
