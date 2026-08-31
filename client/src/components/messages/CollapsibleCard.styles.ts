import type { CSSProperties } from "react";

import { border, radiusPanel, surface } from "../../styles/tokens";

export const card: CSSProperties = {
  borderRadius: radiusPanel,
  overflow: "hidden",
  background: surface,
};

export const header: CSSProperties = {
  width: "100%",
  padding: "14px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  userSelect: "none",
};

export const summary: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export const chevron = (open: boolean): CSSProperties => ({
  transition: "transform var(--ds-dur-base) var(--ds-ease)",
  transform: open ? "rotate(180deg)" : "rotate(0deg)",
  color: "var(--mantine-color-dimmed)",
});

export const body: CSSProperties = {
  borderTop: border,
};
