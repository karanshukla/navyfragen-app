/**
 * TypeScript handles for the design tokens declared in `src/index.css`.
 *
 * Components import from here rather than typing `var(--nf-…)` inline, so a
 * renamed token is a compile error instead of a colour that silently resolves
 * to nothing. The values are scheme-aware in CSS, which is why none of these
 * take an `isDark` argument — the browser picks.
 */

/** Card surface sitting on the page background. */
export const surface = "var(--nf-surface)";
/** One step above transparent; for inset rows and secondary chrome. */
export const surfaceGhost = "var(--nf-surface-ghost)";
/** Radial halo behind the login / OAuth panels. */
export const surfaceGlow = "var(--nf-surface-glow)";
/** Keyboard-focus wash on a list row. */
export const surfaceHighlight = "var(--nf-surface-highlight)";

export const textDimmed = "var(--mantine-color-dimmed)";
export const textDefault = "var(--mantine-color-text)";
/** Inline links and other accented body text. */
export const link = "var(--nf-link)";
/** Brand-coloured emphasis inside body copy. */
export const accentText = "var(--nf-accent-text)";

export const border = "1px solid var(--mantine-color-default-border)";
export const borderColor = "var(--mantine-color-default-border)";

export const dangerFg = "var(--nf-danger-fg)";
/** Error headings and failure text, tuned to clear AA on page and card surfaces. */
export const dangerText = "var(--nf-tone-red)";
export const selectedBg = "var(--nf-selected-bg)";
export const selectedBorder = "var(--nf-selected-border)";

/** Foreground colours valid only on top of a brand gradient. */
export const onGrad = "var(--nf-on-grad)";
export const onGradMuted = "var(--nf-on-grad-muted)";
export const onGradAccent = "var(--nf-on-grad-accent)";
export const onGradFaint = "var(--nf-on-grad-faint)";
export const onGradFill = "var(--nf-on-grad-fill)";
export const onGradBorder = "var(--nf-on-grad-border)";

/**
 * The primary brand gradient. Per docs/design-tokens.md this is the background for
 * every interactive card — login, ask, inbox hero, gradient question cards.
 */
export const gradMark = "var(--nf-grad-mark)";
/** Reserved for the "default" image-export theme preview. Not a UI surface. */
export const gradDark = "var(--nf-grad-dark)";

export const radiusCard = "var(--nf-radius-card)";
export const radiusPanel = "var(--nf-radius-panel)";
export const radiusControl = "var(--nf-radius-control)";
export const radiusPill = "var(--nf-radius-pill)";

/**
 * The one gradient pairing for Mantine's `variant="gradient"`. Both shades are
 * pinned a step deeper than the palette default so white button labels clear AA
 * at the purple end, where plain `purple` lands at 4.0:1.
 */
export const BRAND_GRADIENT = { from: "royal.6", to: "purple.7", deg: 135 } as const;

/** Sunshine call-to-action: yellow fill demands the dark brand ink, not white. */
export const sunshineButton = {
  color: "var(--nf-midnight)",
  fontWeight: 700,
} as const;
