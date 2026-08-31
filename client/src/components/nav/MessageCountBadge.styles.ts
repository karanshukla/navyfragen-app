import type { CSSProperties } from "react";

import { radiusPill } from "../../styles/tokens";

/** The highlight fill demands the dark brand ink; white on it is 1.5:1. */
export const badge: CSSProperties = {
  background: "var(--ds-attention-bg)",
  color: "var(--ds-attention-fg)",
  padding: "1px 7px",
  borderRadius: radiusPill,
  fontSize: 9,
  fontWeight: 700,
  lineHeight: 1.6,
};
