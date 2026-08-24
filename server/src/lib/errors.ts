import type { ErrorCode } from "./contracts";

// Returns "" rather than a placeholder so callers can spell their own fallback
// as `errorMessage(err) || "Failed to ..."`.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    return typeof msg === "string" ? msg : "";
  }
  return "";
}

export interface ErrorResponseBody {
  error: ErrorCode;
  message: string;
}

/**
 * Builds the `{ error, message }` shape every route error response uses:
 * `error` is the stable code, `message` the untranslated English fallback.
 *
 * @see [error-codes.test.ts](../tests/error-codes.test.ts): pins that route
 * handlers only ever reach the wire through this helper, never a literal
 * prose `error` value.
 */
export function errorBody(code: ErrorCode, message: string): ErrorResponseBody {
  return { error: code, message };
}
