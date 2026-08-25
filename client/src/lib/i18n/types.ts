import type { ErrorCode } from "../contracts";

/**
 * Locales the client bundle can render as a full `Messages` catalog. Distinct
 * from `TouchpointLocale` (`../touchpointTranslations.ts`) — that axis is the
 * profile owner's audience, this one is the logged-in user reading the app.
 * `user_settings.uiLocale` itself is a free-form string column, so a stored
 * value here can be ahead of what this bundle supports; resolution treats
 * anything outside this union as "fall back to `en`" rather than widening it.
 */
export type Locale = "en";

/**
 * Maps every server `ErrorCode` (`../contracts.ts`) to a localized string, plus
 * a generic fallback for a code this catalog doesn't know or an `error` value
 * that isn't a code at all. `Record<ErrorCode, string>` is exhaustive on
 * purpose — an unmapped code fails `bun run typecheck` rather than falling
 * back silently at runtime.
 *
 * @see [apiErrors.ts](./apiErrors.ts): the three-rung resolution this backs —
 * catalog entry, then the server's own `message`, then `generic`.
 */
export interface ErrorMessages {
  codes: Record<ErrorCode, string>;
  generic: string;
}

export interface CommonMessages {
  cancel: string;
  confirm: string;
  delete: string;
  retry: string;
  copy: string;
  copied: string;
  copyLink: string;
  share: string;
  userAltFallback: string;
  shortcuts: {
    title: string;
    home: string;
    login: string;
    messages: string;
    settings: string;
    focusCycleCards: string;
    navigateCards: string;
    closeExpandedCard: string;
  };
}

/**
 * Scoped to `errors` on purpose: this ships ahead of #402's ~210-string
 * extraction, so keeping the error-code strings in their own sub-object lets
 * #402 fill in the rest of `Messages` around this without touching it.
 */
export interface Messages {
  errors: ErrorMessages;
  common: CommonMessages;
}
