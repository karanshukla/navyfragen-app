import type { CSSProperties } from "react";

import { surface } from "../styles/tokens";

export const card: CSSProperties = {
  height: "100%",
  display: "flex",
  flexDirection: "column",
  borderRadius: 14,
  padding: 20,
  background: surface,
};

/** Grows so every card in a row ends its action at the same baseline. */
export const description: CSSProperties = {
  lineHeight: 1.5,
  flexGrow: 1,
  marginBottom: 16,
};
