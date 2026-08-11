import { useEffect, useState } from "react";

/** Long enough that a warm render never trips it, short enough to beat impatience. */
export const SLOW_REQUEST_HINT_MS = 2000;

/**
 * True once `active` has stayed true for `delayMs` without interruption, so a
 * caller can explain a wait that has outlasted what a spinner alone justifies.
 * Resets the moment `active` goes false, so a fast request never flashes the
 * hint on its way out.
 *
 * @see [useSlowRequestHint.test.ts](../tests/lib/useSlowRequestHint.test.ts) —
 * pins both sides of the delay boundary and the reset.
 */
export function useSlowRequestHint(active: boolean, delayMs = SLOW_REQUEST_HINT_MS): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return slow;
}
