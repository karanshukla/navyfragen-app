import type { CSSProperties } from "react";

import { surface, surfaceGlow } from "../styles/tokens";

export const panel: CSSProperties = {
  background: surface,
  position: "relative",
  overflow: "hidden",
};

export const glow: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: surfaceGlow,
  pointerEvents: "none",
};

export const content: CSSProperties = {
  position: "relative",
};

/** Drop shadow under the mark at the top of an auth panel. */
export const mark: CSSProperties = {
  borderRadius: 16,
  boxShadow: "0 12px 30px -10px rgba(20,18,58,0.4)",
};
