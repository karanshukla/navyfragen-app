/**
 * Deliberately not a full i18n rollout (#266). Only two kinds of string live
 * here: copy that leaves the DOM into the OS share sheet, where browser-level
 * Google Translate structurally cannot reach it, and the ask-card a stranger
 * reads — which the profile OWNER pins to their audience's language, since a
 * visitor's browser locale is the wrong signal for it.
 *
 * Adding a locale = one object in `translations` and one entry in
 * `touchpointLocales`. No extraction tooling, no missing-key linting.
 */

import { APP_NAME } from "./brand";

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
    inboxShareTitle: `Send me anonymous messages on ${APP_NAME}!`,
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
    inboxShareTitle: `¡Envíame mensajes anónimos en ${APP_NAME}!`,
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
    inboxShareTitle: `Envie mensagens anônimas para mim no ${APP_NAME}!`,
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
    inboxShareTitle: `Sende mir anonyme Nachrichten auf ${APP_NAME}!`,
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
    inboxShareTitle: `Envoie-moi des messages anonymes sur ${APP_NAME} !`,
    inboxShareText: (name) => `Envoie des messages anonymes à ${name} !`,
  },
};

/** Anything unset or unrecognised falls back to English. */
export function getTouchpointTranslations(
  locale: string | null | undefined
): TouchpointTranslations {
  if (locale && locale in translations) {
    return translations[locale as TouchpointLocale];
  }
  return translations.en;
}
