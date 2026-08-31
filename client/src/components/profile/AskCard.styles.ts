import type { CSSProperties } from "react";

import { borderColor, onGrad, onGradMuted, radiusCard } from "../../styles/tokens";

export const card = (gradient: string): CSSProperties => ({
  borderRadius: radiusCard,
  padding: 28,
  background: gradient,
  border: `2px solid ${borderColor}`,
  cursor: "text",
  position: "relative",
  overflow: "hidden",
});

export const headline: CSSProperties = {
  color: onGrad,
  letterSpacing: "-0.01em",
};

/** The input is a paper affordance on the gradient, same as the reply composer. */
export const textarea = {
  input: {
    backgroundColor: "var(--ds-compose-bg)",
    color: "var(--ds-compose-fg)",
    border: "none",
  },
  description: {
    color: onGradMuted,
    textAlign: "right" as const,
  },
} as const;

/** Red-on-gradient rather than the page's alert tint, which the card would swallow. */
export const errorAlert = {
  root: {
    background: "rgba(220,38,38,0.18)",
    border: "1px solid rgba(220,38,38,0.35)",
  },
  message: { color: "#FCA5A5" },
  closeButton: { color: "#FCA5A5" },
} as const;

export const closedNotice: CSSProperties = {
  color: onGradMuted,
};
