import type { CSSProperties } from "react";

import { radiusPill } from "../../styles/tokens";

/** Sunshine fill demands the dark brand ink; white on it is 1.5:1. */
export const badge: CSSProperties = {
  background: "var(--ds-sunshine)",
  color: "var(--ds-midnight)",
  padding: "1px 7px",
  borderRadius: radiusPill,
  fontSize: 9,
  fontWeight: 700,
  lineHeight: 1.6,
};
