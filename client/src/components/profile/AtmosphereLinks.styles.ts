import type { CSSProperties } from "react";

import { border, radiusPill, surfaceGhost, textDimmed } from "../../styles/tokens";

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
  border,
  borderRadius: radiusPill,
  padding: "4px 10px",
  fontSize: 11,
};

/** Holds a mark inside the same bubble a name gets, so the two swap cleanly. */
export const markSlot: CSSProperties = {
  display: "inline-flex",
};

/** The name a mark is replaced by once there is room to read one. */
export const wordmark: CSSProperties = {
  fontWeight: 600,
  lineHeight: 1.2,
};

/** The same bubble as a named app, so the row reads as one set of pills. */
export const overflow: CSSProperties = {
  ...link,
  fontWeight: 600,
};

/**
 * Keeps every catalog mark to the size of the icons already in this row. The
 * sizing that actually lands is `.ds-atmosphere-mark svg` in `index.css`: a
 * catalog mark carries its own `width`/`height` attributes and ignores this.
 */
export const mark: CSSProperties = {
  display: "inline-flex",
  width: 14,
  height: 14,
};
