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
  color: textDimmed,
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
