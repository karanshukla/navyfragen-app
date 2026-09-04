import type { CSSProperties } from "react";

import { radiusPill, surfaceGhost, textDimmed } from "../../styles/tokens";

/**
 * Quieter than the copy and share buttons across the row: these say something
 * about whose profile this is rather than offering another thing to press.
 *
 * Not dimmed any further than the token. Every catalog mark is monochrome
 * `fill="currentColor"`, so opacity on top of a dimmed colour stops four
 * different brands being tellable apart at this size.
 */
export const link: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: textDimmed,
  background: surfaceGhost,
  borderRadius: radiusPill,
  padding: "4px 6px",
};

/** Holds a mark at the padding a name gets, so the two swap without a jump. */
export const markSlot: CSSProperties = {
  display: "inline-flex",
  padding: "0 2px",
};

/** The name a mark is replaced by once there is room to read one. */
export const wordmark: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.2,
  padding: "0 2px",
};

export const overflow: CSSProperties = {
  background: surfaceGhost,
  borderRadius: radiusPill,
  color: textDimmed,
  fontSize: 11,
  fontWeight: 600,
};

/**
 * Keeps every catalog mark to the size of the icons already in this row. The
 * sizing that actually lands is `.ds-atmosphere-mark svg` in `index.css`: a
 * catalog mark carries its own `width`/`height` attributes and ignores this.
 */
export const mark: CSSProperties = {
  display: "inline-flex",
  width: 16,
  height: 16,
};
