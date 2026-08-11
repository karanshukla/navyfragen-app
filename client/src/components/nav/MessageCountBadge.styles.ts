import type { CSSProperties } from "react";

import { fontMono, radiusPill } from "../../styles/tokens";

/** Sunshine fill demands the dark brand ink; white on it is 1.5:1. */
export const badge: CSSProperties = {
  background: "var(--nf-sunshine)",
  color: "var(--nf-midnight)",
  padding: "1px 7px",
  borderRadius: radiusPill,
  fontFamily: fontMono,
  fontSize: 9,
  fontWeight: 700,
  lineHeight: 1.6,
};
