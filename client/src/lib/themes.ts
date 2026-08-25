import type { Messages } from "./i18n/types";

export const imageThemeIds = ["default", "compressed", "twitter"] as const;
export type ImageThemeId = (typeof imageThemeIds)[number];

export function imageThemeLabels(messages: Messages): Record<ImageThemeId, string> {
  return messages.themes.image;
}

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

const PROFILE_CARD_GRADIENTS: Record<string, string> = {
  royal: "var(--nf-grad-mark)",
  aurora: "var(--nf-grad-aurora)",
  ember: "var(--nf-grad-ember)",
  verdant: "var(--nf-grad-verdant)",
};

export function profileCardThemes(messages: Messages): Record<string, ProfileCardTheme> {
  return Object.fromEntries(
    Object.entries(PROFILE_CARD_GRADIENTS).map(([id, gradient]) => [
      id,
      {
        label: messages.themes.profileCard[id as keyof Messages["themes"]["profileCard"]],
        gradient,
      },
    ])
  );
}

export function profileCardGradient(theme: string | null | undefined): string {
  return (theme && PROFILE_CARD_GRADIENTS[theme]) || PROFILE_CARD_GRADIENTS.royal;
}
