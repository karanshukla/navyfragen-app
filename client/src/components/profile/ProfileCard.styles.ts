import type { CSSProperties } from "react";

import { borderColor, gradMark, radiusPanel, surfaceGhost, textDefault } from "../../styles/tokens";

const BANNER_HEIGHT = 160;
const AVATAR_SIZE = 84;

export const card: CSSProperties = {
  borderRadius: radiusPanel,
  overflow: "hidden",
};

export const banner = (url?: string): CSSProperties => ({
  height: BANNER_HEIGHT,
  background: url ? `url(${url}) center/cover no-repeat` : gradMark,
  position: "relative",
});

/** Darkens an arbitrary user banner so the avatar's ring stays visible on it. */
export const bannerScrim: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.2)",
};

export const body: CSSProperties = {
  padding: "0 24px 18px",
  position: "relative",
  background: surfaceGhost,
};

export const avatar: CSSProperties = {
  border: "4px solid var(--mantine-color-body)",
  position: "absolute",
  top: -AVATAR_SIZE / 2,
  left: 16,
};

export const displayName: CSSProperties = {
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
};

export const blueskyLink: CSSProperties = {
  flexShrink: 0,
  borderColor,
  color: textDefault,
};

export const description: CSSProperties = {
  lineHeight: 1.5,
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
};
