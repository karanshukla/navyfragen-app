/**
 * The push-event contract, shared by sw.ts and the server's dispatcher. Every
 * field is optional: the service worker defaults anything missing, and extra
 * fields the server sends are ignored.
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
