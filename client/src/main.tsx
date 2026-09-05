import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { registerSW } from "virtual:pwa-register";

import { queryClient } from "./api/queryClient";
import { AppLayout } from "./AppLayout";
import { BounceLogosProvider } from "./components/BounceLogosContext";
import { I18nProvider } from "./lib/i18n";
import { markUpdateReady, setUpdateApplier } from "./lib/swUpdate";
import navyfragenTheme from "./Theme";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={navyfragenTheme}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            {/* A notification's message can be a component that reads the
                catalog (e.g. Messages.tsx's PostedNotice), and Notifications
                renders that content through its own portal — which resolves
                context from its position in the tree, not from where the
                content was created — so it has to sit inside I18nProvider,
                not beside it. */}
            <Notifications position="bottom-right" autoClose={5000} limit={3} />
            <BounceLogosProvider>
              <AppLayout />
              <ReactQueryDevtools initialIsOpen={false} />
            </BounceLogosProvider>
          </I18nProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>
);

// In development this uninstalls any stale service worker before the app boots,
// closing the race where a leftover production SW intercepts React Query's first
// fetches. "prompt" mode means a new deploy never reloads the page on its own —
// it reports the waiting worker here and the header's Update button applies it.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    markUpdateReady();
  },
});

setUpdateApplier(() => {
  void updateSW();
});
