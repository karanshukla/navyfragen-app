/**
 * `uiLocale` plumbing: the logged-in user's own app language, distinct from
 * `touchpointLocale` (`../touchpointTranslations.ts`), which is the profile
 * owner's audience's language. See #400 for the two-axis split.
 *
 * Ships English, Spanish (`es`, #406), and Portuguese/German/French
 * (`pt`/`de`/`fr`, #410) — every non-English locale is lazy-loaded through
 * `LOCALE_LOADERS` so the default bundle still carries only `en`.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useSession } from "../../api/authService";
import { useUserSettings } from "../../api/settingsService";
import { STORAGE_PREFIX } from "../contracts";
import { readStoredJson, writeStoredJson } from "../safeLocalStorage";

import { en } from "./en";
import type { Locale, Messages } from "./types";

export type { Locale, Messages };

const STORAGE_KEY = `${STORAGE_PREFIX}_ui_locale`;

/** Locales this bundle can render as a full catalog. */
const SUPPORTED_LOCALES: readonly Locale[] = ["en", "es", "pt", "de", "fr"];

/** Ordered list for the `/customise` "App language" `<Select>`. `en` first = default. */
export const uiLocaleOptions: { value: Locale; label: string }[] = [
  { value: "en", label: "English" /* i18n-allow */ },
  { value: "es", label: "Español" /* i18n-allow */ },
  { value: "pt", label: "Português" /* i18n-allow */ },
  { value: "de", label: "Deutsch" /* i18n-allow */ },
  { value: "fr", label: "Français" /* i18n-allow */ },
];

/**
 * One lazy loader per non-English locale, `await import("./es")` style so the
 * default bundle carries only `en` — each non-English locale ships as its own
 * chunk, fetched only when a user actually selects it.
 */
const LOCALE_LOADERS: ReadonlyMap<string, () => Promise<Messages>> = new Map([
  ["es", () => import("./es").then((m) => m.es)],
  ["pt", () => import("./pt").then((m) => m.pt)],
  ["de", () => import("./de").then((m) => m.de)],
  ["fr", () => import("./fr").then((m) => m.fr)],
]);

function primarySubtag(tag: string): string {
  return tag.split("-")[0].toLowerCase();
}

/**
 * The tag `ActiveCatalog.locale` is allowed to carry, which is narrower than
 * the tag that was requested: everything downstream of it — `Intl.NumberFormat`
 * (`../useNumberFormat.ts`), `toLocaleString` (`../formatTimestamp.ts`) —
 * throws `RangeError` on a malformed BCP-47 tag rather than falling back, and
 * that throw lands mid-render and takes the whole page down. A tag the
 * formatters would reject is therefore reduced to its primary subtag, which
 * `resolveUiLocale` only ever produced from a supported list.
 *
 * `Intl.getCanonicalLocales` is the arbiter rather than a regex here because
 * it is the same grammar the formatters themselves apply.
 *
 * @see [i18n.test.tsx](../../tests/lib/i18n.test.tsx) — pins that a malformed
 * regional tag still renders, and formats, instead of throwing.
 */
function renderableTag(locale: string): string {
  try {
    Intl.getCanonicalLocales(locale);
    return locale;
  } catch {
    return primarySubtag(locale);
  }
}

/**
 * `readStoredJson` returns whatever JSON the key holds, and the locale rungs
 * below call string methods on it — so a key holding an object (a stale
 * format, a collision) would throw rather than read as absent.
 */
function readStoredLocale(): string | null {
  const stored = readStoredJson<unknown>(STORAGE_KEY);
  return typeof stored === "string" ? stored : null;
}

export interface ResolveUiLocaleInput {
  /** `user_settings.uiLocale`, read only once `settingsLoaded` is true. */
  settingsUiLocale: string | null | undefined;
  settingsLoaded: boolean;
  isLoggedIn: boolean;
  storedLocale: string | null;
  navigatorLanguages: readonly string[];
}

/**
 * First hit wins: the logged-in user's saved setting, then whatever this
 * browser last resolved to, then the first `navigator.languages` entry this
 * bundle supports, then English.
 *
 * `settingsUiLocale`/`storedLocale` can be any string a past or future client
 * wrote — not narrowed to `Locale` — so an unsupported value here is not a
 * bug, `loadCatalog` is what falls back to `en` for those and reports that it
 * did.
 *
 * @see [i18n.test.tsx](../../tests/lib/i18n.test.tsx) — one test per rung.
 */
export function resolveUiLocale({
  settingsUiLocale,
  settingsLoaded,
  isLoggedIn,
  storedLocale,
  navigatorLanguages,
}: ResolveUiLocaleInput): string {
  if (isLoggedIn && settingsLoaded && settingsUiLocale) return settingsUiLocale;
  if (storedLocale) return storedLocale;
  for (const tag of navigatorLanguages) {
    const primary = primarySubtag(tag);
    if ((SUPPORTED_LOCALES as readonly string[]).includes(primary)) return primary;
  }
  return "en";
}

export interface ActiveCatalog {
  /**
   * The locale actually being rendered, which is `en` whenever the requested
   * one has no catalog. Anything that follows the UI — `documentElement.lang`,
   * date and number formatting — has to read this rather than the request, or
   * it describes a page that isn't on screen.
   */
  locale: string;
  messages: Messages;
}

/**
 * Matched on the primary subtag, so `en-GB` renders the English catalog while
 * keeping its own tag — the catalog picks the words, the full tag still picks
 * the date order and the digit grouping.
 *
 * @see [i18n.test.tsx](../../tests/lib/i18n.test.tsx) — pins the `en`,
 * regional-variant, unregistered-locale, real-loader, and rejected-loader
 * cases.
 */
export async function loadCatalog(locale: string): Promise<ActiveCatalog> {
  const tag = renderableTag(locale);
  const primary = primarySubtag(tag);
  if (primary === "en") return { locale: tag, messages: en };
  const loader = LOCALE_LOADERS.get(primary);
  if (!loader) return { locale: "en", messages: en };
  try {
    return { locale: tag, messages: await loader() };
  } catch {
    return { locale: "en", messages: en };
  }
}

export const I18nContext = createContext<ActiveCatalog | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const { data: userSettings, isSuccess: settingsLoaded } = useUserSettings();
  const isLoggedIn = Boolean(session?.isLoggedIn);
  const uiLocale = userSettings?.uiLocale;

  const resolvedLocale = useMemo(
    () =>
      resolveUiLocale({
        settingsUiLocale: uiLocale,
        settingsLoaded,
        isLoggedIn,
        storedLocale: readStoredLocale(),
        navigatorLanguages: navigator.languages ?? [navigator.language],
      }),
    [uiLocale, settingsLoaded, isLoggedIn]
  );

  useEffect(() => {
    // A change made while logged in must also land in localStorage, or a
    // logged-out reload on this device snaps back to the browser locale.
    if (isLoggedIn && settingsLoaded && uiLocale) {
      writeStoredJson(STORAGE_KEY, uiLocale);
    }
  }, [isLoggedIn, settingsLoaded, uiLocale]);

  const [active, setActive] = useState<ActiveCatalog>({ locale: "en", messages: en });

  useEffect(() => {
    let cancelled = false;
    loadCatalog(resolvedLocale).then((next) => {
      if (cancelled) return;
      setActive(next);
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedLocale]);

  useEffect(() => {
    document.documentElement.lang = active.locale;
  }, [active.locale]);

  return <I18nContext.Provider value={active}>{children}</I18nContext.Provider>;
}

export function useTranslations(): Messages {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslations must be used within an I18nProvider" /* i18n-allow */);
  }
  return context.messages;
}

export function useLocale(): string {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useLocale must be used within an I18nProvider" /* i18n-allow */);
  }
  return context.locale;
}
