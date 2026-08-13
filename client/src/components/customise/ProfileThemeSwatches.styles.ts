import type { CSSProperties } from "react";

/**
 * Wraps rather than squeezing: four fixed columns clipped the widest label on a
 * narrow card. The cap keeps swatches swatch-sized on a full-width row.
 */
export const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 132px))",
  gap: 10,
};

export const fill = (gradient: string): CSSProperties => ({
  height: "100%",
  background: gradient,
});
