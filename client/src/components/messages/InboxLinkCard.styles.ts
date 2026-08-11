import type { CSSProperties } from "react";

import { gradMark, onGradAccent, onGradMuted, radiusCard } from "../../styles/tokens";

export const card: CSSProperties = {
  borderRadius: radiusCard,
  background: gradMark,
  overflow: "hidden",
};

export const eyebrow: CSSProperties = {
  color: onGradMuted,
};

export const url: CSSProperties = {
  color: onGradAccent,
  wordBreak: "break-all",
};
