import type { CSSProperties } from "react";

import {
  border,
  fontMono,
  radiusPill,
  surfaceGhost,
  textDefault,
  textDimmed,
} from "../../styles/tokens";

export const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: surfaceGhost,
  border,
  padding: "6px 12px 6px 10px",
  borderRadius: radiusPill,
  fontFamily: fontMono,
  fontSize: 12,
  color: textDimmed,
};

export const pillHandle: CSSProperties = {
  color: textDefault,
  fontWeight: 600,
};

export const action: CSSProperties = {
  background: surfaceGhost,
  border,
  color: textDimmed,
};
