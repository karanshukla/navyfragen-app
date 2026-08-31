/**
 * TypeScript handles for the design tokens declared in `src/index.css`.
 *
 * Components import from here rather than typing `var(--ds-…)` inline, so a
 * renamed token is a compile error instead of a colour that silently resolves
 * to nothing. The values are scheme-aware in CSS, which is why none of these
 * take an `isDark` argument — the browser picks.
 */

/** Card surface sitting on the page background. */
export const surface = "var(--ds-surface)";
/** One step above transparent; for inset rows and secondary chrome. */
export const surfaceGhost = "var(--ds-surface-ghost)";
/** Radial halo behind the login / OAuth panels. */
export const surfaceGlow = "var(--ds-surface-glow)";
/** Keyboard-focus wash on a list row. */
export const surfaceHighlight = "var(--ds-surface-highlight)";

export const textDimmed = "var(--mantine-color-dimmed)";
export const textDefault = "var(--mantine-color-text)";
/** Inline links and other accented body text. */
export const link = "var(--ds-link)";
/** Brand-coloured emphasis inside body copy. */
export const accentText = "var(--ds-accent-text)";

export const border = "1px solid var(--mantine-color-default-border)";
export const borderColor = "var(--mantine-color-default-border)";

export const dangerFg = "var(--ds-danger-fg)";
/** Error headings and failure text, tuned to clear AA on page and card surfaces. */
export const dangerText = "var(--ds-tone-red)";
export const selectedBg = "var(--ds-selected-bg)";
export const selectedBorder = "var(--ds-selected-border)";

/** Foreground colours valid only on top of a brand gradient. */
export const onGrad = "var(--ds-on-grad)";
export const onGradMuted = "var(--ds-on-grad-muted)";
export const onGradAccent = "var(--ds-on-grad-accent)";
export const onGradFaint = "var(--ds-on-grad-faint)";
export const onGradFill = "var(--ds-on-grad-fill)";
export const onGradBorder = "var(--ds-on-grad-border)";

/**
 * The primary brand gradient. Per docs/design-tokens.md this is the background for
 * every interactive card — login, ask, inbox hero, gradient question cards.
 */
export const gradMark = "var(--ds-grad-mark)";
/** Reserved for the "default" image-export theme preview. Not a UI surface. */
export const gradDark = "var(--ds-grad-dark)";

export const radiusCard = "var(--ds-radius-card)";
export const radiusPanel = "var(--ds-radius-panel)";
export const radiusControl = "var(--ds-radius-control)";
export const radiusPill = "var(--ds-radius-pill)";

/**
 * The one gradient pairing for Mantine's `variant="gradient"`. Both shades are
 * pinned a step deeper than the palette default so white button labels clear AA
 * at the accent end, where plain `accent` lands at 4.0:1.
 */
export const BRAND_GRADIENT = { from: "primary.6", to: "accent.7", deg: 135 } as const;

/** Highlight call-to-action: the bright fill demands the dark brand ink, not white. */
export const highlightButton = {
  color: "var(--ds-ink)",
  fontWeight: 700,
} as const;
