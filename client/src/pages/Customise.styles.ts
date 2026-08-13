import type { InputStylesNames, InputWrapperStylesNames } from "@mantine/core";
import type { CSSProperties } from "react";

/** Right-aligned above the field so it reads as a counter, not a second description. */
export const promptCounter: Partial<
  Record<InputStylesNames | InputWrapperStylesNames, CSSProperties>
> = {
  description: { textAlign: "right", marginBottom: 6 },
};
