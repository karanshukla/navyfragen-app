import { ERROR_CODES, type ErrorCode } from "../contracts";

import type { Messages } from "./types";

const CODE_SET: ReadonlySet<string> = new Set(ERROR_CODES);

function isErrorCode(value: string | undefined): value is ErrorCode {
  return value !== undefined && CODE_SET.has(value);
}

/** Shape of what `apiClient.ts` throws — `error` is a machine code today, but
 * a network failure or a legacy response can still land here with neither
 * field, which is exactly the case `generic` exists for. */
export interface ApiErrorLike {
  error?: string;
  message?: string;
}

/**
 * Three rungs, in order: a catalog string for the server's machine code, the
 * server's own English `message`, then a localized fallback — `fallback` where
 * the call site has copy for the thing that failed, `errors.generic`
 * otherwise. Never renders the code itself or an unrecognized `error` value —
 * those are for logs, not humans.
 *
 * @see [apiErrors.test.ts](../../tests/lib/apiErrors.test.ts) — one test per
 * rung, plus the caller-supplied fallback.
 */
export function resolveApiErrorMessage(
  err: ApiErrorLike | null | undefined,
  messages: Messages,
  fallback: string = messages.errors.generic
): string {
  const code = err?.error;
  if (isErrorCode(code)) return messages.errors.codes[code];
  if (err?.message) return err.message;
  return fallback;
}
