import type { CSSProperties } from "react";

import { accentText, surface } from "../../styles/tokens";

export const panel: CSSProperties = {
  borderRadius: 14,
  padding: 24,
  background: surface,
};

export const value = (fontSize: number): CSSProperties => ({
  fontSize,
  color: accentText,
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
});
