/**
 * Hand-maintained translations for the handful of "touchpoint" strings that
 * leave the DOM (the OS share sheet / clipboard) or are the highest-conversion
 * copy on the app (the ask-card a stranger reads before sending a message).
 *
 * This is deliberately NOT a full client i18n rollout — the rest of the app is
 * a static SPA and browser-level Google Translate handles page chrome. These
 * specific strings are the ones Google Translate structurally cannot reach
 * (share payloads) or that a profile owner may want pinned to their audience's
 * language regardless of a visitor's browser settings (the ask-card).
 *
 * See issue #266 for the rationale. Whose preference controls it: the profile
 * OWNER (not the visitor) — they know what language their audience speaks.
 * Stored server-side in user_settings.touchpointLocale (null = English).
 *
 * Adding a locale = adding one object to `touchpointTranslations` and one entry
 * to `touchpointLocales`. No extraction tooling, no missing-key linting infra.
 */

export type TouchpointLocale = "en" | "es" | "pt" | "de" | "fr";

/** Ordered list for the /customise language <Select>. `en` first = default. */
export const touchpointLocales: { value: TouchpointLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];

export interface TouchpointTranslations {
  /** Ask-card headline (#1): "Send {name} an anonymous message" */
  headline: (displayName: string) => string;
  /** Textarea placeholder (#2): "Ask something…" */
  placeholder: string;
  /** Send button label (#3): "Send" */
  sendLabel: string;
  /** Anonymity disclaimer paragraph (#4) */
  disclaimer: string;
  /** Closed-inbox message shown in place of the send form (#177) */
  inboxClosed: string;
  /** Profile-page navigator.share() title (#5) — leaves the DOM */
  shareTitle: (displayName: string) => string;
  /** Owner's own "share my inbox" title (#6) — leaves the DOM into a tweet/DM */
  inboxShareTitle: string;
  /** Owner's own "share my inbox" text (#6) — leaves the DOM into a tweet/DM */
  inboxShareText: (displayName: string) => string;
}

const translations: Record<TouchpointLocale, TouchpointTranslations> = {
  en: {
    headline: (name) => `Send ${name} an anonymous message`,
    placeholder: "Ask something…",
    sendLabel: "Send",
    disclaimer:
      "Your message will be sent anonymously to the user. They may post it publicly on Bluesky, so please don't share any personal information or passwords. Be curious, but respectful and kind!",
    inboxClosed: "This inbox is closed and not accepting new messages right now.",
    shareTitle: (name) => `Send ${name} an anonymous message`,
    inboxShareTitle: "Send me anonymous messages on Navyfragen!",
    inboxShareText: (name) => `Send ${name} anonymous messages!`,
  },
  es: {
    headline: (name) => `Envía a ${name} un mensaje anónimo`,
    placeholder: "Pregunta algo…",
    sendLabel: "Enviar",
    disclaimer:
      "Tu mensaje se enviará de forma anónima. Puede que se publique públicamente en Bluesky, así que por favor no compartas información personal ni contraseñas. ¡Sé curioso, pero respetuoso y amable!",
    inboxClosed:
      "Esta bandeja de entrada está cerrada y no acepta mensajes nuevos en este momento.",
    shareTitle: (name) => `Envía a ${name} un mensaje anónimo`,
    inboxShareTitle: "¡Envíame mensajes anónimos en Navyfragen!",
    inboxShareText: (name) => `¡Envía a ${name} mensajes anónimos!`,
  },
  pt: {
    headline: (name) => `Envie uma mensagem anônima para ${name}`,
    placeholder: "Pergunte algo…",
    sendLabel: "Enviar",
    disclaimer:
      "Sua mensagem será enviada anonimamente. Ela pode ser publicada publicamente no Bluesky, então por favor não compartilhe informações pessoais ou senhas. Seja curioso, mas respeitoso e gentil!",
    inboxClosed:
      "Esta caixa de entrada está fechada e não está aceitando novas mensagens no momento.",
    shareTitle: (name) => `Envie uma mensagem anônima para ${name}`,
    inboxShareTitle: "Envie mensagens anônimas para mim no Navyfragen!",
    inboxShareText: (name) => `Envie mensagens anônimas para ${name}!`,
  },
  de: {
    headline: (name) => `Sende ${name} eine anonyme Nachricht`,
    placeholder: "Frag etwas…",
    sendLabel: "Senden",
    disclaimer:
      "Deine Nachricht wird anonym gesendet. Sie könnte öffentlich auf Bluesky gepostet werden, also teile bitte keine persönlichen Informationen oder Passwörter. Sei neugierig, aber respektvoll und freundlich!",
    inboxClosed: "Dieser Posteingang ist geschlossen und nimmt derzeit keine neuen Nachrichten an.",
    shareTitle: (name) => `Sende ${name} eine anonyme Nachricht`,
    inboxShareTitle: "Sende mir anonyme Nachrichten auf Navyfragen!",
    inboxShareText: (name) => `Sende ${name} anonyme Nachrichten!`,
  },
  fr: {
    headline: (name) => `Envoie un message anonyme à ${name}`,
    placeholder: "Pose une question…",
    sendLabel: "Envoyer",
    disclaimer:
      "Ton message sera envoyé anonymement. Il peut être publié publiquement sur Bluesky, alors ne partage aucune information personnelle ni mot de passe. Sois curieux, mais respectueux et bienveillant !",
    inboxClosed:
      "Cette boîte de réception est fermée et n'accepte pas de nouveaux messages pour le moment.",
    shareTitle: (name) => `Envoie un message anonyme à ${name}`,
    inboxShareTitle: "Envoie-moi des messages anonymes sur Navyfragen !",
    inboxShareText: (name) => `Envoie des messages anonymes à ${name} !`,
  },
};

/**
 * Resolve a (possibly null/unknown) locale to its translations, falling back to
 * English for anything unset or not in the table. English is the default when
 * touchpointLocale is null, so a profile that never set a locale renders the
 * exact same strings it did before this feature existed.
 */
export function getTouchpointTranslations(
  locale: string | null | undefined
): TouchpointTranslations {
  if (locale && locale in translations) {
    return translations[locale as TouchpointLocale];
  }
  return translations.en;
}
