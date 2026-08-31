import type { CSSProperties } from "react";

import { surfaceHighlight } from "../../styles/tokens";

/** One row's height, held constant so the form below never shifts. */
const ROW_HEIGHT = 64;

export const box: CSSProperties = {
  background: "var(--ds-surface-ghost)",
  overflow: "hidden",
};

export const staticRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: ROW_HEIGHT,
};

export const row = (focused: boolean): CSSProperties => ({
  ...staticRow,
  outline: focused ? "2px solid var(--ds-focus-ring)" : "none",
  outlineOffset: "-2px",
  background: focused ? surfaceHighlight : undefined,
});
