import type { CSSProperties } from "react";

/**
 * One row, like the image-theme picker: equal columns that shrink with the card.
 * The cap keeps swatches swatch-sized on a full-width row.
 *
 * @see [ProfileThemeSwatches.test.tsx](../../tests/components/ProfileThemeSwatches.test.tsx)
 * — pins the single row, which is what keeps this card level with the prompt
 * card sharing its row.
 */
export const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 132px))",
  gap: 10,
};

export const fill = (gradient: string): CSSProperties => ({
  height: "100%",
  background: gradient,
});
