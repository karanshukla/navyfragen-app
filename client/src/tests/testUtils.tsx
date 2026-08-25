import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router";

import { BounceLogosProvider } from "../components/BounceLogosContext";
import { I18nContext } from "../lib/i18n";
import { en } from "../lib/i18n/en";
import type { Messages } from "../lib/i18n/types";

interface Options extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  colorScheme?: "light" | "dark";
  messages?: Messages;
}

/**
 * Supplies i18n directly through `I18nContext` rather than mounting the real
 * `I18nProvider`, which calls `useSession()`/`useUserSettings()` — hooks a
 * per-file `settingsService`/`authService` mock can narrow away entirely,
 * throwing when `I18nProvider` calls the now-missing export. `messages` lets
 * an individual test override the catalog; every other test gets `en` for
 * free.
 *
 * `Notifications` sits inside `I18nContext.Provider` rather than beside it —
 * it renders toast content (e.g. a notification `message` built from a
 * component that calls `useTranslations()`) through its own portal, which
 * resolves context from its position in the React tree, not from where that
 * content was created.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { route = "/", colorScheme, messages = en, ...options }: Options = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MantineProvider forceColorScheme={colorScheme}>
          <I18nContext.Provider value={{ locale: "en", messages }}>
            <Notifications />
            <MemoryRouter initialEntries={[route]}>
              <BounceLogosProvider>{children}</BounceLogosProvider>
            </MemoryRouter>
          </I18nContext.Provider>
        </MantineProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
