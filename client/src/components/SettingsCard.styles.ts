import type { CSSProperties } from "react";

import { surface } from "../styles/tokens";

export const card: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  borderRadius: 14,
  padding: 20,
  background: surface,
};

/** Fixed height so titles line up whether or not the card carries a control. */
export const header: CSSProperties = {
  minHeight: 34,
  marginBottom: 10,
};

/** Grows so every card in a row ends its action at the same baseline. */
export const body: CSSProperties = {
  flexGrow: 1,
  marginBottom: 16,
};

export const description: CSSProperties = {
  lineHeight: 1.5,
};

export const note: CSSProperties = {
  marginTop: 8,
  lineHeight: 1.45,
};
