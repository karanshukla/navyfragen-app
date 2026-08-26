import type { CSSProperties } from "react";

import { borderColor, selectedBg, selectedBorder, textDefault } from "../styles/tokens";

export const button = (selected: boolean, disabled?: boolean): CSSProperties => ({
  background: selected ? selectedBg : "transparent",
  border: `1.5px solid ${selected ? selectedBorder : borderColor}`,
  borderRadius: 10,
  padding: 8,
  cursor: disabled ? "default" : "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  flex: 1,
  minWidth: 0,
  transition: "border-color var(--nf-dur-fast) var(--nf-ease)",
});

export const preview = (aspectRatio: string): CSSProperties => ({
  aspectRatio,
  borderRadius: 5,
  overflow: "hidden",
});

export const label: CSSProperties = {
  color: textDefault,
  // A long single-word preset name (pt "Verdejante") is narrower than its
  // swatch on every viewport but the smallest phones, where it breaks rather
  // than spilling over the neighbouring swatch.
  overflowWrap: "break-word",
};
