import type { Page } from "@playwright/test";

/**
 * Mirrors `client/src/lib/contracts.ts`'s `STORAGE_PREFIX` ("navyfragen") plus
 * the `_ui_locale` suffix `client/src/lib/i18n/index.tsx` appends to it.
 * Spelled out as a literal rather than imported, same convention
 * `contracts.ts` documents for its own consumers: a rename over there should
 * fail this instead of silently following it.
 */
const UI_LOCALE_STORAGE_KEY = "navyfragen_ui_locale";

/**
 * Seeds `uiLocale` into localStorage before any app script runs, so a
 * logged-out page load resolves a known locale instead of falling through to
 * `navigator.languages`. Call before the first `page.goto`.
 */
export async function seedUiLocale(page: Page, locale = "en"): Promise<void> {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    UI_LOCALE_STORAGE_KEY,
    JSON.stringify(locale),
  ] as [string, string]);
}
