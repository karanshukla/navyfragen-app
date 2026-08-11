import type { CSSProperties } from "react";

const SECTION_GAP = 34;

export const section = (last?: boolean): CSSProperties => ({
  marginBottom: last ? 0 : SECTION_GAP,
});

export const eyebrow: CSSProperties = {
  letterSpacing: "0.05em",
};
