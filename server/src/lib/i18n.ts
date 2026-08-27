/**
 * Server-side catalog for the strings built with no browser in the loop: push
 * notification title/body and the seeded example questions. Distinct from the
 * client's `Messages` catalog (`client/src/lib/i18n/`) — zero overlapping
 * keys, different lifecycles, so this is a standalone module rather than a
 * shared package. Keyed off `uiLocale` (the account owner's own language),
 * never `touchpointLocale` (the owner's audience) — both push and the seeded
 * questions are read by the owner, not their audience.
 *
 * Ships `en`, `es`, `pt`, `de`, and `fr`. Adding a locale is one object below
 * plus one entry in `CATALOGS`; nothing else in this module (or its callers)
 * changes.
 */
import { APP_NAME } from "./brand";

export interface ServerMessages {
  push: {
    titleForHandle: (handle: string) => string;
    titleAnonymous: string;
    body: string;
  };
  exampleQuestions: readonly string[];
}

export type ServerLocale = "en" | "es" | "pt" | "de" | "fr";

const en = {
  push: {
    titleForHandle: (handle: string) => `New question for @${handle}`,
    titleAnonymous: "New anonymous question",
    body: `Someone sent you an anonymous question on ${APP_NAME}!`,
  },
  exampleQuestions: [
    "Do you like cats?",
    "Do you like dogs?",
    "What's your favorite movie?",
    "If you could travel anywhere, where would you go?",
    "What's something most people don't know about you?",
    "What's the best piece of advice you've ever received?",
    "What are you currently obsessed with?",
    "What's your hot take on something totally mundane?",
  ],
} satisfies ServerMessages;

const es = {
  push: {
    titleForHandle: (handle: string) => `Nueva pregunta para @${handle}`,
    titleAnonymous: "Nueva pregunta anónima",
    body: `¡Alguien te envió una pregunta anónima en ${APP_NAME}!`,
  },
  exampleQuestions: [
    "¿Te gustan los gatos?",
    "¿Te gustan los perros?",
    "¿Cuál es tu película favorita?",
    "Si pudieras viajar a cualquier lugar, ¿a dónde irías?",
    "¿Qué es algo que la mayoría de la gente no sabe sobre ti?",
    "¿Cuál es el mejor consejo que has recibido?",
    "¿Con qué estás obsesionado/a en este momento?",
    "¿Cuál es tu opinión más controvertida sobre algo totalmente cotidiano?",
  ],
} satisfies ServerMessages;

const pt = {
  push: {
    titleForHandle: (handle: string) => `Nova pergunta para @${handle}`,
    titleAnonymous: "Nova pergunta anônima",
    body: `Alguém te enviou uma pergunta anônima no ${APP_NAME}!`,
  },
  exampleQuestions: [
    "Você gosta de gatos?",
    "Você gosta de cachorros?",
    "Qual é o seu filme favorito?",
    "Se você pudesse viajar para qualquer lugar, para onde iria?",
    "O que a maioria das pessoas não sabe sobre você?",
    "Qual é o melhor conselho que você já recebeu?",
    "Com o que você está obcecado(a) atualmente?",
    "Qual é a sua opinião impopular sobre algo totalmente banal?",
  ],
} satisfies ServerMessages;

const de = {
  push: {
    titleForHandle: (handle: string) => `Neue Frage für @${handle}`,
    titleAnonymous: "Neue anonyme Frage",
    body: `Jemand hat dir eine anonyme Frage auf ${APP_NAME} geschickt!`,
  },
  exampleQuestions: [
    "Magst du Katzen?",
    "Magst du Hunde?",
    "Was ist dein Lieblingsfilm?",
    "Wenn du überallhin reisen könntest, wohin würdest du gehen?",
    "Was weiß die meisten Leute nicht über dich?",
    "Was ist der beste Rat, den du je bekommen hast?",
    "Wovon bist du gerade besessen?",
    "Was ist deine unpopuläre Meinung zu etwas völlig Alltäglichem?",
  ],
} satisfies ServerMessages;

const fr = {
  push: {
    titleForHandle: (handle: string) => `Nouvelle question pour @${handle}`,
    titleAnonymous: "Nouvelle question anonyme",
    body: `Quelqu'un t'a envoyé une question anonyme sur ${APP_NAME} !`,
  },
  exampleQuestions: [
    "Tu aimes les chats ?",
    "Tu aimes les chiens ?",
    "Quel est ton film préféré ?",
    "Si tu pouvais voyager n'importe où, où irais-tu ?",
    "Qu'est-ce que la plupart des gens ne savent pas sur toi ?",
    "Quel est le meilleur conseil qu'on t'ait jamais donné ?",
    "Par quoi es-tu obsédé(e) en ce moment ?",
    "Quel est ton avis impopulaire sur un sujet totalement banal ?",
  ],
} satisfies ServerMessages;

const CATALOGS: Record<ServerLocale, ServerMessages> = { en, es, pt, de, fr };

/**
 * The primary subtag, lowercased: the part of a BCP-47 tag that picks the
 * words. `es-419` and `ES` both reduce to `es`.
 */
function primarySubtag(tag: string): string {
  return tag.split("-")[0].toLowerCase();
}

/**
 * Whether `value` is a well-formed BCP-47 tag whose primary subtag has a
 * catalog — the check the `/settings` route runs before persisting a locale,
 * so a stored `uiLocale`/`touchpointLocale` is always something every reader
 * of it (this module, the client's `Intl` formatters, the Go OG service) can
 * accept. Well-formedness is `Intl.getCanonicalLocales`' answer rather than a
 * regex of our own: it is the same grammar the formatters themselves throw
 * `RangeError` on.
 *
 * @see [i18n.test.ts](../tests/i18n.test.ts) — pins the regional-variant,
 * malformed-tag, and unsupported-language cases.
 */
export function isSupportedLocaleTag(value: string): boolean {
  try {
    Intl.getCanonicalLocales(value);
  } catch {
    return false;
  }
  return Object.hasOwn(CATALOGS, primarySubtag(value));
}

/**
 * Falls back to `en` for an unset, unrecognized, or not-yet-shipped locale —
 * the same "fall back rather than widen" contract as the client's
 * `loadCatalog`, and matched on the primary subtag for the same reason, so a
 * regional variant reads its language's catalog instead of English.
 *
 * `Object.hasOwn`, not `in`: `in` answers true for every name on
 * `Object.prototype`, so a locale of `toString` or `__proto__` would return a
 * prototype member typed as a catalog and every caller would throw on the
 * first property read. Never throws: a caller with a bad or missing locale
 * string still gets a full catalog.
 *
 * @see [i18n.test.ts](../tests/i18n.test.ts) — pins the prototype-key and
 * regional-variant cases alongside the plain fallback.
 */
export function getServerMessages(locale: string | null | undefined): ServerMessages {
  if (!locale) return CATALOGS.en;
  const primary = primarySubtag(locale);
  if (Object.hasOwn(CATALOGS, primary)) {
    return CATALOGS[primary as ServerLocale];
  }
  return CATALOGS.en;
}
