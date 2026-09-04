import type { CSSProperties } from "react";

import { radiusPill, surfaceGhost, textDimmed } from "../../styles/tokens";

/**
 * Quieter than the copy and share buttons across the row: these say something
 * about whose profile this is rather than offering another thing to press. Full
 * opacity arrives on hover, which `ActionIcon`'s `subtle` variant handles.
 */
export const link: CSSProperties = {
  color: textDimmed,
  opacity: 0.75,
};

export const overflow: CSSProperties = {
  background: surfaceGhost,
  borderRadius: radiusPill,
  color: textDimmed,
  fontSize: 11,
  fontWeight: 600,
};

/** Keeps every catalog mark to the size of the icons already in this row. */
export const mark: CSSProperties = {
  display: "inline-flex",
  width: 14,
  height: 14,
};
