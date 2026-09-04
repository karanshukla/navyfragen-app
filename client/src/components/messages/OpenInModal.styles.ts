import type { CSSProperties } from "react";

import {
  borderColor,
  radiusControl,
  surfaceGhost,
  textDefault,
  textDimmed,
} from "../../styles/tokens";

export const sectionHeading: CSSProperties = {
  color: textDimmed,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  borderRadius: radiusControl,
  border: `1px solid ${borderColor}`,
  background: surfaceGhost,
  color: textDefault,
  textAlign: "left",
  textDecoration: "none",
  cursor: "pointer",
};

/**
 * The catalog hands each entry its own logo as an SVG sized by the source
 * artwork, so the box constrains it rather than the icon constraining itself.
 */
export const rowIcon: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 22,
  height: 22,
};

export const rowText: CSSProperties = {
  minWidth: 0,
  flex: 1,
};

export const rowName: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.2,
  color: textDefault,
};

export const rowDescription: CSSProperties = {
  fontSize: 11,
  color: textDimmed,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
