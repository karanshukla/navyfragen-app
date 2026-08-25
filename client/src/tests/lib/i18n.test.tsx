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
import { en } from "../../lib/i18n/en";
import { es } from "../../lib/i18n/es";

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
        navigatorLanguages: ["fr-FR", "en-US"],
      })
    ).toBe("en");
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
        navigatorLanguages: ["fr-FR", "de-DE"],
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
    // The locale it reports is the one being rendered. Echoing "de" back here
    // would label an English page German for a screen reader and format its
    // dates in a language nothing on screen is written in.
    expect(await loadCatalog("de")).toEqual({ locale: "en", messages: en });
  });

  it("resolves the real es catalog for locale 'es'", async () => {
    expect(await loadCatalog("es")).toEqual({ locale: "es", messages: es });
  });

  it("keeps a regional Spanish tag, so dates and numbers stay regional", async () => {
    expect(await loadCatalog("es-MX")).toEqual({ locale: "es-MX", messages: es });
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

describe("I18nProvider / useTranslations / useLocale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.lang = "en";
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
      data: { uiLocale: "de" },
      isLoading: false,
      isSuccess: true,
    } as any);
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("probe")).toHaveAttribute("data-locale", "en");
    });
    expect(document.documentElement.lang).toBe("en");
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
    });
    expect(document.documentElement.lang).toBe("es");
    expect(screen.getByTestId("probe")).toHaveTextContent(JSON.stringify(es));
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
