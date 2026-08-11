import type { CSSProperties } from "react";

export const panel: CSSProperties = {
  marginTop: 4,
  background: "var(--nf-compose-bg)",
  borderRadius: "var(--nf-radius-control)",
  padding: 12,
  border: "1.5px solid var(--nf-compose-border)",
};

export const textarea = {
  input: {
    background: "transparent",
    color: "var(--nf-compose-fg)",
    border: "none",
    padding: 0,
  },
} as const;

/**
 * Not `c="dimmed"`: the page's dimmed colour is tuned for the page background
 * and lands at 2.6:1 on the composer's paper in dark mode.
 */
export const count: CSSProperties = {
  color: "var(--nf-compose-fg-muted)",
};
