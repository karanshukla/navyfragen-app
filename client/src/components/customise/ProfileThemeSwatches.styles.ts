import type { CSSProperties } from "react";

export const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
};

export const fill = (gradient: string): CSSProperties => ({
  height: "100%",
  background: gradient,
});
