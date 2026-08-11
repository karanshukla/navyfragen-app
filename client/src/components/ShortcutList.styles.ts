import type { CSSProperties } from "react";

import { textDimmed } from "../styles/tokens";

/** Small-caps section label rather than a display heading. */
export const heading: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: textDimmed,
  marginBottom: "var(--mantine-spacing-sm)",
};

export const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};
