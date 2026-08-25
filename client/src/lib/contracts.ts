/**
 * Identifiers that outlive the brand.
 *
 * `STORAGE_PREFIX` names keys already written to users' localStorage; changing
 * it discards their saved state rather than migrating it. It does not follow
 * the app name — derive nothing here from `brand.ts`.
 *
 * Tests spell these keys out as literals rather than importing this constant,
 * so that renaming it fails them instead of silently following it.
 *
 * @see [navSectionStorage.test.ts](../tests/lib/navSectionStorage.test.ts) and
 * [profileService.test.ts](../tests/profileService.test.ts): pin the two key
 * shapes built from this prefix.
 */

export const STORAGE_PREFIX = "navyfragen";

/**
 * Mirrors `server/src/lib/contracts.ts`'s `ERROR_CODES`. Every server route
 * error response is `{ error: <one of these>, message: "..." }`; `error` is
 * the stable code, never localized. `client/src/lib/i18n/en.ts` maps each of
 * these to a string in `errors.codes`, typed as an exhaustive
 * `Record<ErrorCode, string>` so an unmapped code fails `bun run typecheck`
 * rather than falling back silently at runtime.
 *
 * @see [error-codes.test.ts](../../../server/src/tests/error-codes.test.ts):
 * pins this list byte-for-byte against the server's.
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
  "E2E_LOGIN_UNAVAILABLE",
  "E2E_LOGIN_NO_DID",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
