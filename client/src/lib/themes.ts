export const themes = {
  default: "Default",
  compressed: "Compressed",
  twitter: "Twitter Style",
};

/**
 * Gradient tokens rather than arbitrary hexes, so white headline/textarea/Send
 * stay legible on every option and `--nf-*` remains the single source of truth
 * for colour. Deliberately separate from the image-export themes above: a live
 * card and an exported image have different legibility constraints.
 *
 * @see [themes.test.ts](../tests/lib/themes.test.ts) — pins the fallback.
 */
export interface ProfileCardTheme {
  label: string;
  gradient: string;
}

export const profileCardThemes: Record<string, ProfileCardTheme> = {
  royal: { label: "Royal", gradient: "var(--nf-grad-mark)" },
  aurora: { label: "Aurora", gradient: "var(--nf-grad-aurora)" },
  ember: { label: "Ember", gradient: "var(--nf-grad-ember)" },
  verdant: { label: "Verdant", gradient: "var(--nf-grad-verdant)" },
};

export function profileCardGradient(theme: string | null | undefined): string {
  return (theme && profileCardThemes[theme]?.gradient) || "var(--nf-grad-mark)";
}
