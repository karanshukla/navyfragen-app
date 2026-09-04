import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import * as settingsService from "../../api/settingsService";
import { STORAGE_PREFIX } from "../../lib/contracts";
import {
  I18nProvider,
  useTranslations,
  useLocale,
  resolveUiLocale,
  loadCatalog,
} from "../../lib/i18n";
import { de } from "../../lib/i18n/de";
import { en } from "../../lib/i18n/en";
import { es } from "../../lib/i18n/es";
import { fr } from "../../lib/i18n/fr";
import { pt } from "../../lib/i18n/pt";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useSession: vi.fn() };
});

vi.mock("../../api/settingsService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/settingsService")>();
  return { ...actual, useUserSettings: vi.fn() };
});

const mockUseSession = vi.mocked(authService.useSession);
const mockUseUserSettings = vi.mocked(settingsService.useUserSettings);

const STORAGE_KEY = `${STORAGE_PREFIX}_ui_locale`;

function Probe() {
  const messages = useTranslations();
  const locale = useLocale();
  return (
    <div data-testid="probe" data-locale={locale}>
      {JSON.stringify(messages)}
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <Probe />
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("resolveUiLocale", () => {
  it("rung 1: uses the logged-in user's saved uiLocale when settings are loaded", () => {
    expect(
      resolveUiLocale({
        settingsUiLocale: "es",
        settingsLoaded: true,
        isLoggedIn: true,
        storedLocale: "de",
        navigatorLanguages: ["fr"],
      })
    ).toBe("es");
  });

  it("skips rung 1 when logged out, even if settings carry a stale uiLocale", () => {
    expect(
      resolveUiLocale({
        settingsUiLocale: "es",
        settingsLoaded: true,
        isLoggedIn: false,
        storedLocale: "de",
        navigatorLanguages: [],
      })
    ).toBe("de");
  });

  it("skips rung 1 while settings are still loading", () => {
    expect(
      resolveUiLocale({
        settingsUiLocale: "es",
        settingsLoaded: false,
        isLoggedIn: true,
        storedLocale: "de",
        navigatorLanguages: [],
      })
    ).toBe("de");
  });

  it("rung 2: falls back to localStorage when no setting is saved", () => {
    expect(
      resolveUiLocale({
        settingsUiLocale: null,
        settingsLoaded: true,
        isLoggedIn: true,
        storedLocale: "de",
        navigatorLanguages: ["fr"],
      })
    ).toBe("de");
  });

  it("rung 3: falls back to the first navigator language this bundle supports", () => {
    expect(
      resolveUiLocale({
        settingsUiLocale: null,
        settingsLoaded: true,
        isLoggedIn: false,
        storedLocale: null,
        navigatorLanguages: ["it-IT", "en-US"],
      })
    ).toBe("en");
  });

  it("rung 3 finds a #410 locale further down the navigator language list", () => {
    expect(
      resolveUiLocale({
        settingsUiLocale: null,
        settingsLoaded: true,
        isLoggedIn: false,
        storedLocale: null,
        navigatorLanguages: ["it-IT", "fr-FR", "en-US"],
      })
    ).toBe("fr");
  });

  it("rung 3 matches on the primary subtag, ignoring region", () => {
    expect(
      resolveUiLocale({
        settingsUiLocale: null,
        settingsLoaded: true,
        isLoggedIn: false,
        storedLocale: null,
        navigatorLanguages: ["en-GB"],
      })
    ).toBe("en");
  });

  it("rung 4: defaults to en when nothing matches", () => {
    expect(
      resolveUiLocale({
        settingsUiLocale: null,
        settingsLoaded: true,
        isLoggedIn: false,
        storedLocale: null,
        navigatorLanguages: ["it-IT", "ja-JP"],
      })
    ).toBe("en");
  });
});

describe("counts reach the catalog as numbers", () => {
  // The signature is the point: Intl.PluralRules.select() takes a number, so
  // an entry that only ever saw a formatted string could not choose a plural
  // form. #406 depends on this staying a number.
  it("formats a grouped count rather than interpolating it raw", () => {
    expect(en.nav.unreadCount(1234)).toBe("1,234 unread");
    expect(en.messagesPage.newMessagesCount(1234)).toBe("1,234 new");
  });

  it("formats both counts in the preferences summary", () => {
    expect(en.postingPreferences.summary(1000, 2000)).toBe("1,000 of 2,000 on");
  });

  // Spanish adjectives agree in number with the noun — "1 nuevo" vs "2 nuevos" —
  // which is exactly the shape #406 depends on the count arriving as a number
  // for. One test inside the singular rule, one outside it.
  it("uses the singular Spanish form for exactly one", () => {
    expect(es.nav.unreadCount(1)).toBe("1 no leído");
    expect(es.messagesPage.newMessagesCount(1)).toBe("1 nuevo");
  });

  it("uses the plural Spanish form for zero and for more than one", () => {
    expect(es.nav.unreadCount(0)).toBe("0 no leídos");
    expect(es.nav.unreadCount(1234)).toBe("1234 no leídos");
    expect(es.messagesPage.newMessagesCount(2)).toBe("2 nuevos");
  });

  // Portuguese and French both classify 0 with the singular ("one") category
  // per CLDR, unlike Spanish — the opposite of the naive assumption, and
  // exactly the kind of thing #410 warned is a common bug to get backwards.
  it("uses the singular Portuguese form for both zero and one", () => {
    expect(pt.nav.unreadCount(0)).toBe("0 não lida");
    expect(pt.nav.unreadCount(1)).toBe("1 não lida");
    expect(pt.messagesPage.newMessagesCount(0)).toBe("0 nova");
    expect(pt.messagesPage.newMessagesCount(1)).toBe("1 nova");
  });

  it("uses the plural Portuguese form for more than one", () => {
    expect(pt.nav.unreadCount(2)).toBe("2 não lidas");
    expect(pt.messagesPage.newMessagesCount(2)).toBe("2 novas");
  });

  it("uses the singular French form for both zero and one", () => {
    expect(fr.nav.unreadCount(0)).toBe("0 non lu");
    expect(fr.nav.unreadCount(1)).toBe("1 non lu");
    expect(fr.messagesPage.newMessagesCount(0)).toBe("0 nouveau");
    expect(fr.messagesPage.newMessagesCount(1)).toBe("1 nouveau");
  });

  it("uses the plural French form for more than one", () => {
    expect(fr.nav.unreadCount(2)).toBe("2 non lus");
    expect(fr.messagesPage.newMessagesCount(2)).toBe("2 nouveaux");
  });

  // German count labels are bare predicate adjectives that don't inflect for
  // number ("1 ungelesen" / "2 ungelesen"), unlike the other three locales.
  it("uses the same uninflected German form regardless of count", () => {
    expect(de.nav.unreadCount(0)).toBe("0 ungelesen");
    expect(de.nav.unreadCount(1)).toBe("1 ungelesen");
    expect(de.nav.unreadCount(2)).toBe("2 ungelesen");
    expect(de.messagesPage.newMessagesCount(1)).toBe("1 neu");
    expect(de.messagesPage.newMessagesCount(2)).toBe("2 neu");
  });

  it("formats grouped counts per locale in the preferences summary", () => {
    expect(pt.postingPreferences.summary(3, 5)).toBe("3 de 5 ativas");
    expect(de.postingPreferences.summary(1000, 2000)).toBe("1.000 von 2.000 aktiv");
    expect(fr.postingPreferences.summary(3, 5)).toBe("3 sur 5 actives");
  });
});

describe("es catalog interpolations", () => {
  // es is lazy-loaded and never the active catalog elsewhere in this suite (en
  // is), so its own interpolating functions get no incidental coverage from
  // component rendering the way en's do — each one needs a direct call here.
  it("interpolates every function-valued entry", () => {
    expect(es.common.switchedToAccount("alice.bsky.social")).toBe("Cambiaste a @alice.bsky.social");
    expect(es.postingPreferences.summary(3, 5)).toBe("3 de 5 activas");
    expect(es.nav.friendGroups.moots.emptyText("Navyfragen")).toBe(
      "Todavía no tienes amigos mutuos en Navyfragen."
    );
    expect(es.nav.friendGroups.following.emptyText("Navyfragen")).toBe(
      "Todavía no tienes seguidos unidireccionales en Navyfragen."
    );
    expect(es.nav.friendGroups.oomfs.emptyText("Navyfragen")).toBe(
      "Ninguno de tus seguidores está en Navyfragen todavía."
    );
    expect(es.publicProfilePage.notOnAppTitle("Navyfragen")).toBe("No está en Navyfragen");
    expect(es.userMenu.logOut("alice.bsky.social")).toBe("Cerrar sesión @alice.bsky.social");
    expect(es.home.shareTitle("Navyfragen")).toBe("¡Envíame mensajes anónimos en Navyfragen!");
    expect(es.settingsPage.pdsSyncDescription("Navyfragen")).toContain("Navyfragen");
    expect(es.settingsPage.feedTitle("Navyfragen")).toBe("Feed de Navyfragen");
    expect(es.settingsPage.feedDescription("Navyfragen")).toContain("Navyfragen");
    expect(es.settingsPage.dailyNotificationsDescription("Navyfragen")).toContain("Navyfragen");
    expect(es.settingsPage.deleteMyDataDescription("Navyfragen")).toContain("Navyfragen");
    expect(es.openInPicker.openInLabel("Bluesky")).toBe("Abrir en Bluesky");
    expect(es.openInPicker.copyLinkLabel("Bluesky")).toBe("Copiar el enlace de Bluesky");
    expect(es.profileCard.viewOn("Tangled")).toBe("Ver en Tangled");
    expect(es.customisePage.openProfilesInApp("Navyfragen")).toBe(
      "Abrir los perfiles en Navyfragen"
    );
    expect(es.customisePage.openProfilesInAppDescription("Navyfragen")).toContain("Navyfragen");
    expect(es.profileUrlBar.moreAtmosphereApps(2)).toBe("2 aplicaciones más");
  });
});

describe("pt/de/fr catalog interpolations", () => {
  // Same rationale as the es block above: each of these is lazy-loaded and
  // never the active catalog elsewhere in this suite, so every
  // function-valued entry needs a direct call here for coverage.
  it("interpolates every function-valued entry in pt", () => {
    expect(pt.common.switchedToAccount("alice.bsky.social")).toBe(
      "Você mudou para @alice.bsky.social"
    );
    expect(pt.postingPreferences.summary(3, 5)).toBe("3 de 5 ativas");
    expect(pt.nav.friendGroups.moots.emptyText("Navyfragen")).toBe(
      "Você ainda não tem amigos mútuos no Navyfragen."
    );
    expect(pt.nav.friendGroups.following.emptyText("Navyfragen")).toBe(
      "Você ainda não tem seguidos unilaterais no Navyfragen."
    );
    expect(pt.nav.friendGroups.oomfs.emptyText("Navyfragen")).toBe(
      "Nenhum dos seus seguidores está no Navyfragen ainda."
    );
    expect(pt.publicProfilePage.notOnAppTitle("Navyfragen")).toBe("Não está no Navyfragen");
    expect(pt.userMenu.logOut("alice.bsky.social")).toBe("Sair @alice.bsky.social");
    expect(pt.home.shareTitle("Navyfragen")).toBe(
      "Envie mensagens anônimas para mim no Navyfragen!"
    );
    expect(pt.settingsPage.pdsSyncDescription("Navyfragen")).toContain("Navyfragen");
    expect(pt.settingsPage.feedTitle("Navyfragen")).toBe("Feed do Navyfragen");
    expect(pt.settingsPage.feedDescription("Navyfragen")).toContain("Navyfragen");
    expect(pt.settingsPage.dailyNotificationsDescription("Navyfragen")).toContain("Navyfragen");
    expect(pt.settingsPage.deleteMyDataDescription("Navyfragen")).toContain("Navyfragen");
    expect(pt.openInPicker.openInLabel("Bluesky")).toBe("Abrir em Bluesky");
    expect(pt.openInPicker.copyLinkLabel("Bluesky")).toBe("Copiar o link do Bluesky");
    expect(pt.profileCard.viewOn("Tangled")).toBe("Ver no Tangled");
    expect(pt.customisePage.openProfilesInApp("Navyfragen")).toBe("Abrir os perfis no Navyfragen");
    expect(pt.customisePage.openProfilesInAppDescription("Navyfragen")).toContain("Navyfragen");
    expect(pt.profileUrlBar.moreAtmosphereApps(2)).toBe("2 outros apps");
  });

  it("interpolates every function-valued entry in de", () => {
    expect(de.common.switchedToAccount("alice.bsky.social")).toBe(
      "Zu @alice.bsky.social gewechselt"
    );
    expect(de.postingPreferences.summary(3, 5)).toBe("3 von 5 aktiv");
    expect(de.nav.friendGroups.moots.emptyText("Navyfragen")).toBe(
      "Noch keine gegenseitigen Follows auf Navyfragen."
    );
    expect(de.nav.friendGroups.following.emptyText("Navyfragen")).toBe(
      "Noch keine einseitigen Follows auf Navyfragen."
    );
    expect(de.nav.friendGroups.oomfs.emptyText("Navyfragen")).toBe(
      "Noch keiner deiner Follower ist auf Navyfragen."
    );
    expect(de.publicProfilePage.notOnAppTitle("Navyfragen")).toBe("Nicht auf Navyfragen");
    expect(de.userMenu.logOut("alice.bsky.social")).toBe("@alice.bsky.social abmelden");
    expect(de.home.shareTitle("Navyfragen")).toBe("Sende mir anonyme Nachrichten auf Navyfragen!");
    expect(de.settingsPage.pdsSyncDescription("Navyfragen")).toContain("Navyfragen");
    expect(de.settingsPage.feedTitle("Navyfragen")).toBe("Navyfragen-Feed");
    expect(de.settingsPage.feedDescription("Navyfragen")).toContain("Navyfragen");
    expect(de.settingsPage.dailyNotificationsDescription("Navyfragen")).toContain("Navyfragen");
    expect(de.settingsPage.deleteMyDataDescription("Navyfragen")).toContain("Navyfragen");
    expect(de.openInPicker.openInLabel("Bluesky")).toBe("In Bluesky öffnen");
    expect(de.openInPicker.copyLinkLabel("Bluesky")).toBe("Den Bluesky-Link kopieren");
    expect(de.profileCard.viewOn("Tangled")).toBe("Auf Tangled ansehen");
    expect(de.customisePage.openProfilesInApp("Navyfragen")).toBe("Profile in Navyfragen öffnen");
    expect(de.customisePage.openProfilesInAppDescription("Navyfragen")).toContain("Navyfragen");
    expect(de.profileUrlBar.moreAtmosphereApps(2)).toBe("2 weitere Apps");
  });

  it("interpolates every function-valued entry in fr", () => {
    expect(fr.common.switchedToAccount("alice.bsky.social")).toBe("Passé à @alice.bsky.social");
    expect(fr.postingPreferences.summary(3, 5)).toBe("3 sur 5 actives");
    expect(fr.nav.friendGroups.moots.emptyText("Navyfragen")).toBe(
      "Aucun mutuel sur Navyfragen pour l'instant."
    );
    expect(fr.nav.friendGroups.following.emptyText("Navyfragen")).toBe(
      "Aucun abonnement à sens unique sur Navyfragen pour l'instant."
    );
    expect(fr.nav.friendGroups.oomfs.emptyText("Navyfragen")).toBe(
      "Aucun de tes abonnés n'est encore sur Navyfragen."
    );
    expect(fr.publicProfilePage.notOnAppTitle("Navyfragen")).toBe("Pas sur Navyfragen");
    expect(fr.userMenu.logOut("alice.bsky.social")).toBe("Se déconnecter @alice.bsky.social");
    expect(fr.home.shareTitle("Navyfragen")).toBe(
      "Envoie-moi des messages anonymes sur Navyfragen !"
    );
    expect(fr.settingsPage.pdsSyncDescription("Navyfragen")).toContain("Navyfragen");
    expect(fr.settingsPage.feedTitle("Navyfragen")).toBe("Flux Navyfragen");
    expect(fr.settingsPage.feedDescription("Navyfragen")).toContain("Navyfragen");
    expect(fr.settingsPage.dailyNotificationsDescription("Navyfragen")).toContain("Navyfragen");
    expect(fr.settingsPage.deleteMyDataDescription("Navyfragen")).toContain("Navyfragen");
    expect(fr.openInPicker.openInLabel("Bluesky")).toBe("Ouvrir dans Bluesky");
    expect(fr.openInPicker.copyLinkLabel("Bluesky")).toBe("Copier le lien Bluesky");
    expect(fr.profileCard.viewOn("Tangled")).toBe("Voir sur Tangled");
    expect(fr.customisePage.openProfilesInApp("Navyfragen")).toBe(
      "Ouvrir les profils dans Navyfragen"
    );
    expect(fr.customisePage.openProfilesInAppDescription("Navyfragen")).toContain("Navyfragen");
    expect(fr.profileUrlBar.moreAtmosphereApps(2)).toBe("2 autres applis");
  });
});

describe("loadCatalog", () => {
  it("returns the en catalog for locale 'en'", async () => {
    expect(await loadCatalog("en")).toEqual({ locale: "en", messages: en });
  });

  it("keeps a regional English tag, so dates and numbers stay regional", async () => {
    expect(await loadCatalog("en-GB")).toEqual({ locale: "en-GB", messages: en });
  });

  it("reports en, not the request, for a locale this bundle does not (yet) register", async () => {
    // The locale it reports is the one being rendered. Echoing "it" back here
    // would label an English page Italian for a screen reader and format its
    // dates in a language nothing on screen is written in.
    expect(await loadCatalog("it")).toEqual({ locale: "en", messages: en });
  });

  it("resolves the real es catalog for locale 'es'", async () => {
    expect(await loadCatalog("es")).toEqual({ locale: "es", messages: es });
  });

  it("keeps a regional Spanish tag, so dates and numbers stay regional", async () => {
    expect(await loadCatalog("es-MX")).toEqual({ locale: "es-MX", messages: es });
  });

  it("resolves the real pt catalog for locale 'pt'", async () => {
    expect(await loadCatalog("pt")).toEqual({ locale: "pt", messages: pt });
  });

  it("resolves the real de catalog for locale 'de'", async () => {
    expect(await loadCatalog("de")).toEqual({ locale: "de", messages: de });
  });

  it("resolves the real fr catalog for locale 'fr'", async () => {
    expect(await loadCatalog("fr")).toEqual({ locale: "fr", messages: fr });
  });

  it("reduces a malformed tag to one the Intl formatters accept", async () => {
    // "en-"/"es-" are what `Intl.NumberFormat` throws RangeError on. The
    // catalog is still the right one; only the tag is trimmed back.
    expect(await loadCatalog("en-")).toEqual({ locale: "en", messages: en });
    expect(await loadCatalog("es-")).toEqual({ locale: "es", messages: es });
  });

  it("hands back a tag every locale-aware formatter can consume", async () => {
    for (const requested of ["en-", "es-", "en--x", "es-MX", "en-GB", "fr"]) {
      const { locale } = await loadCatalog(requested);
      expect(() => new Intl.NumberFormat(locale).format(1234)).not.toThrow();
      expect(() => new Date(0).toLocaleString(locale, { month: "short" })).not.toThrow();
    }
  });

  it("reports en for a prototype key rather than treating it as a loader", async () => {
    // `LOCALE_LOADERS` is a Map, so `constructor` and `toString` are misses
    // rather than inherited functions that would be called as loaders.
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(await loadCatalog(key)).toEqual({ locale: "en", messages: en });
    }
  });

  it("falls back to en when a registered loader rejects", async () => {
    vi.doMock("../../lib/i18n/es", () => {
      throw new Error("chunk load failed");
    });
    try {
      expect(await loadCatalog("es")).toEqual({ locale: "en", messages: en });
    } finally {
      vi.doUnmock("../../lib/i18n/es");
    }
  });
});

/**
 * Seeded into `<html lang>` before every provider render so each assertion on
 * it proves the provider wrote the tag. Seeding `"en"` instead would let the
 * `en` cases pass without the provider ever running.
 */
const LANG_BEFORE_PROVIDER = "zz";

describe("I18nProvider / useTranslations / useLocale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.lang = LANG_BEFORE_PROVIDER;
  });

  it("throws when used outside an I18nProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/must be used within an I18nProvider/);
    spy.mockRestore();
  });

  it("useLocale throws when used outside an I18nProvider", () => {
    function LocaleOnlyProbe() {
      useLocale();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<LocaleOnlyProbe />)).toThrow(/must be used within an I18nProvider/);
    spy.mockRestore();
  });

  it("exposes the resolved locale via useLocale", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: false } as any);
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("probe")).toHaveAttribute("data-locale", "en");
    });
  });

  it("sets document.documentElement.lang to the locale being rendered", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: true }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: { uiLocale: "en-GB" },
      isLoading: false,
      isSuccess: true,
    } as any);
    renderProvider();
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en-GB");
    });
  });

  it("labels the page en when the requested locale has no catalog to render", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: true }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: { uiLocale: "it" },
      isLoading: false,
      isSuccess: true,
    } as any);
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("probe")).toHaveAttribute("data-locale", "en");
      expect(document.documentElement.lang).toBe("en");
    });
  });

  it("renders the es catalog end to end when uiLocale is 'es'", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: true }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: { uiLocale: "es" },
      isLoading: false,
      isSuccess: true,
    } as any);
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("probe")).toHaveAttribute("data-locale", "es");
      expect(document.documentElement.lang).toBe("es");
    });
    expect(screen.getByTestId("probe")).toHaveTextContent(JSON.stringify(es));
  });

  it.each([
    ["pt", pt],
    ["de", de],
    ["fr", fr],
  ])("renders the %s catalog end to end when uiLocale is '%s'", async (locale, catalog) => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: true }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: { uiLocale: locale },
      isLoading: false,
      isSuccess: true,
    } as any);
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("probe")).toHaveAttribute("data-locale", locale);
      expect(document.documentElement.lang).toBe(locale);
    });
    expect(screen.getByTestId("probe")).toHaveTextContent(JSON.stringify(catalog));
  });

  it("updates document.documentElement.lang when the locale changes with no reload", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: true }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: { uiLocale: "en" },
      isLoading: false,
      isSuccess: true,
    } as any);
    const { rerender } = renderProvider();
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en");
    });

    mockUseUserSettings.mockReturnValue({
      data: { uiLocale: "en-GB" },
      isLoading: false,
      isSuccess: true,
    } as any);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <Probe />
        </I18nProvider>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en-GB");
    });
  });

  it("renders the en catalog by default", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: false } as any);
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("probe")).toHaveTextContent(JSON.stringify(en));
    });
  });

  it("writes the logged-in user's uiLocale through to localStorage", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: true }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: { uiLocale: "en" },
      isLoading: false,
      isSuccess: true,
    } as any);
    renderProvider();
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify("en"));
    });
  });

  it("does not write to localStorage for a logged-out visitor", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
    } as any);
    renderProvider();
    await waitFor(() => screen.getByTestId("probe"));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("does not write to localStorage while the user has not set a uiLocale", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: true }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: { uiLocale: null },
      isLoading: false,
      isSuccess: true,
    } as any);
    renderProvider();
    await waitFor(() => screen.getByTestId("probe"));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("a language picked while logged in survives a logged-out reload", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: true }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: { uiLocale: "en" },
      isLoading: false,
      isSuccess: true,
    } as any);
    renderProvider();
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify("en"));
    });

    // Simulate the reload: a fresh mount, now logged out.
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
    } as any);
    renderProvider();
    await waitFor(() => {
      expect(screen.getAllByTestId("probe")[1]).toHaveTextContent(JSON.stringify(en));
    });
    // The stored value from the logged-in session is still there for the
    // resolution logic to pick up — this pins that a reload doesn't clear it.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify("en"));
  });

  it("does not update state after unmounting before the catalog load resolves", async () => {
    mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
    mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: false } as any);
    const { unmount } = renderProvider();
    // loadCatalog resolves on a microtask; unmounting before it fires exercises
    // the effect's cancelled guard instead of calling setState after unmount.
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("falls back to navigator.language when navigator.languages is unavailable", async () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, "languages");
    Object.defineProperty(window.navigator, "languages", {
      value: undefined,
      configurable: true,
    });
    try {
      mockUseSession.mockReturnValue({ data: { isLoggedIn: false }, isLoading: false } as any);
      mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: false } as any);
      renderProvider();
      await waitFor(() => {
        expect(screen.getByTestId("probe")).toHaveTextContent(JSON.stringify(en));
      });
    } finally {
      if (original) Object.defineProperty(window.navigator, "languages", original);
    }
  });
});
