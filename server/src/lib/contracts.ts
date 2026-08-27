/**
 * Identifiers that outlive the brand.
 *
 * These are on the wire, not on the page. `LEXICON_NSID` names records already
 * written to users' PDSes, and `OAUTH_SCOPE` must match the `scope` in
 * `client/public/client-metadata.json` byte for byte or every login fails.
 * Renaming the app does not rename these — derive nothing here from
 * `brand.ts`.
 *
 * Tests spell these out as literals rather than importing these constants, so
 * that renaming one fails them instead of silently following it.
 *
 * @see [contracts.test.ts](../tests/contracts.test.ts): pins `OAUTH_SCOPE`
 * against the published client metadata.
 * @see [message-service.test.ts](../tests/message-service.test.ts): pins the
 * `at://` URIs built from `LEXICON_NSID`.
 */

export const LEXICON_NSID = "app.navyfragen.message";

export const OAUTH_SCOPE = [
  "atproto",
  "repo:app.bsky.feed.post",
  `repo:${LEXICON_NSID}`,
  "blob:image/*",
  "rpc:app.bsky.actor.getProfile?aud=*",
  "rpc:app.bsky.graph.getFollows?aud=*",
].join(" ");

/**
 * Stable machine codes for `{ error, message }` route responses
 * (`errorBody` in `./errors.ts`). `error` is this code, part of the API
 * contract and never localized or reworded; `message` is the untranslated
 * English sentence, kept for logs and for clients that don't know the code.
 *
 * A client maps a code to a localized string; an unmapped code is a bug, not
 * a fallback path, which is why `client/src/lib/contracts.ts` mirrors this
 * list as an exhaustive `Record<ErrorCode, string>` rather than a partial one.
 *
 * @see [contracts.test.ts](../tests/contracts.test.ts): pins this list
 * byte-for-byte against the client's mirror.
 * @see [error-codes.test.ts](../tests/error-codes.test.ts): pins that no
 * route response falls back to a bare prose `error` value.
 */
export const ERROR_CODES = [
  "NOT_AUTHENTICATED",
  "SESSION_EXPIRED",
  "ACCOUNT_SESSION_EXPIRED",
  "AGENT_INIT_FAILED",
  "INVALID_HANDLE",
  "INVALID_DID",
  "DID_REQUIRED",
  "RECIPIENT_DID_REQUIRED",
  "MESSAGE_TID_REQUIRED",
  "HANDLE_NOT_FOUND",
  "USER_NOT_FOUND",
  "PROFILE_NOT_FOUND",
  "MISSING_OAUTH_TOKEN",
  "INVALID_OAUTH_TOKEN",
  "SERVER_MISCONFIGURED",
  "LOGOUT_FAILED",
  "ACCOUNT_SWITCH_FAILED",
  "EXAMPLE_MESSAGES_FAILED",
  "MESSAGES_FETCH_FAILED",
  "PDS_SYNC_FAILED",
  "PROFILE_FETCH_FAILED",
  "USER_EXISTENCE_CHECK_FAILED",
  "FRIENDS_FETCH_FAILED",
  "BOT_FOLLOW_CHECK_FAILED",
  "PDS_RESOLVE_FAILED",
  "HANDLE_SEARCH_FAILED",
  "HANDLE_RESOLVE_FAILED",
  "SETTINGS_FETCH_FAILED",
  "SETTINGS_UPDATE_FAILED",
  "STATS_FETCH_FAILED",
  "PDS_INFO_FETCH_FAILED",
  "PUSH_NOT_CONFIGURED",
  "PUSH_SUBSCRIBE_FAILED",
  "PUSH_UNSUBSCRIBE_FAILED",
  "INBOX_CLOSED",
  "MESSAGE_SEND_FAILED",
  "MESSAGE_NOT_FOUND",
  "MESSAGE_DELETE_NOT_AUTHORIZED",
  "MESSAGE_DELETE_FAILED",
  "BLUESKY_POST_FAILED",
  "ACCOUNT_DELETE_FAILED",
  "RENDER_QUESTION_NOT_IN_INBOX",
  "RENDER_START_FAILED",
  "LOGIN_INIT_FAILED",
  "E2E_LOGIN_UNAVAILABLE",
  "E2E_LOGIN_NO_DID",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
