export const themes = {
  default: "Default",
  compressed: "Compressed",
  twitter: "Twitter Style",
};

/**
 * Curated colour presets for the public-profile ask card (#275).
 *
 * Each preset is an on-brand gradient token rather than an arbitrary hex, so
 * white headline / textarea / Send button stay legible on every option and the
 * `--nf-*` namespace stays the single source of truth for colour (CLAUDE.md
 * Design Tokens). `royal` is the pre-existing default (--nf-grad-mark); the
 * others are new tokens defined in index.css.
 *
 * Kept independent from the image-export `themes` above — the live card and a
 * reply-image export have different legibility constraints, so conflating them
 * would couple two unrelated preset sets.
 */
export interface ProfileCardTheme {
  label: string;
  /** CSS background value applied to the ask card (a gradient token). */
  gradient: string;
}

export const profileCardThemes: Record<string, ProfileCardTheme> = {
  royal: { label: "Royal", gradient: "var(--nf-grad-mark)" },
  aurora: { label: "Aurora", gradient: "var(--nf-grad-aurora)" },
  ember: { label: "Ember", gradient: "var(--nf-grad-ember)" },
  verdant: { label: "Verdant", gradient: "var(--nf-grad-verdant)" },
};

/** Resolve a stored theme key to its gradient, falling back to the default. */
export function profileCardGradient(theme: string | null | undefined): string {
  return (theme && profileCardThemes[theme]?.gradient) || "var(--nf-grad-mark)";
}
