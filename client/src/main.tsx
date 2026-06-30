import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { queryClient } from "./api/queryClient";
import { AppLayout } from "./AppLayout";
import { InstallPromptProvider } from "./components/InstallPromptContext";
import navyfragenTheme from "./Theme";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={navyfragenTheme}>
      <Notifications position="bottom-right" autoClose={5000} limit={3} />
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <InstallPromptProvider>
            <AppLayout />
            <ReactQueryDevtools initialIsOpen={false} />
          </InstallPromptProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (import.meta.env.PROD) {
        if (registrations.length === 0) {
          navigator.serviceWorker.register("/sw.js").catch(() => {
            /* non-fatal: push just won't be available */
          });
        }
      } else {
        registrations.forEach((reg) => reg.unregister());
      }
    });
  });
}
