import { Logger } from "pino";

export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_RETRY_DELAY_MS = 300;

/**
 * @see [profile-service.test.ts](../tests/profile-service.test.ts) — pins that
 * a call recovering within the attempt budget returns the eventual success,
 * and that the final error names the attempt count once retries are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  logger: Logger,
  logContext: Record<string, unknown>,
  attempts: number = DEFAULT_RETRY_ATTEMPTS,
  delayMs: number = DEFAULT_RETRY_DELAY_MS
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        logger.warn({ ...logContext, err, attempt }, "Call failed, retrying");
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw new Error(`Call failed after ${attempts} attempts`, { cause: lastErr });
}
