/**
 * Dark: translucent glass overlay on the void background.
 * Light: soft lavender card surface.
 *
 * Used for Settings cards, the Home logged-in card, and header action buttons.
 */
export const surfaceBg = (isDark: boolean): string =>
  isDark ? "rgba(255,255,255,0.06)" : "#F2EBFF";

/**
 * Barely-there tinted surface — one step above transparent.
 *
 * Used for the URL breadcrumb pill, share/copy icon buttons,
 * and the profile card content area below the banner.
 */
export const ghostBg = (isDark: boolean): string => (isDark ? "rgba(255,255,255,0.03)" : "#FAF7FF");
