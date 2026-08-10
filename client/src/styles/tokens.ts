/** Dark: translucent glass over the void background. Light: lavender card. */
export const surfaceBg = (isDark: boolean): string =>
  isDark ? "rgba(255,255,255,0.06)" : "#F2EBFF";

/** Barely-there tinted surface — one step above transparent. */
export const ghostBg = (isDark: boolean): string => (isDark ? "rgba(255,255,255,0.03)" : "#FAF7FF");
