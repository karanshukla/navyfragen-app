/**
 * Locales the client bundle can render as a full `Messages` catalog. Distinct
 * from `TouchpointLocale` (`../touchpointTranslations.ts`) — that axis is the
 * profile owner's audience, this one is the logged-in user reading the app.
 * `user_settings.uiLocale` itself is a free-form string column, so a stored
 * value here can be ahead of what this bundle supports; resolution treats
 * anything outside this union as "fall back to `en`" rather than widening it.
 */
export type Locale = "en";

// oxlint-disable-next-line typescript/no-empty-object-type -- filled by #402
export interface Messages {}
