/**
 * Server-side catalog for the strings built with no browser in the loop: push
 * notification title/body and the seeded example questions. Distinct from the
 * client's `Messages` catalog (`client/src/lib/i18n/`) — zero overlapping
 * keys, different lifecycles, so this is a standalone module rather than a
 * shared package. Keyed off `uiLocale` (the account owner's own language),
 * never `touchpointLocale` (the owner's audience) — both push and the seeded
 * questions are read by the owner, not their audience.
 *
 * Ships `en` only. Adding a locale is one object below plus one entry in
 * `CATALOGS`; nothing else in this module (or its callers) changes.
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

export type ServerLocale = "en";

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

const CATALOGS: Record<ServerLocale, ServerMessages> = { en };

/**
 * Falls back to `en` for an unset, unrecognized, or not-yet-shipped locale —
 * the same "fall back rather than widen" contract as the client's
 * `loadCatalog`. Never throws: a caller with a bad or missing locale string
 * still gets a full catalog.
 */
export function getServerMessages(locale: string | null | undefined): ServerMessages {
  if (locale && locale in CATALOGS) {
    return CATALOGS[locale as ServerLocale];
  }
  return CATALOGS.en;
}
