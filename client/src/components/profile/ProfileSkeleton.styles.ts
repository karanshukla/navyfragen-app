import type { CSSProperties } from "react";

import { gradMark } from "../../styles/tokens";

import { card } from "./AskCard.styles";

export const body: CSSProperties = {
  padding: "0 24px 18px",
  position: "relative",
};

/** Same geometry as the real ask card, on the default brand gradient. */
export const askCard: CSSProperties = card(gradMark);
