import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

import { BounceLogosProvider } from "../components/BounceLogosContext";

interface Options extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  colorScheme?: "light" | "dark";
}

export function renderWithProviders(
  ui: React.ReactElement,
  { route = "/", colorScheme, ...options }: Options = {}
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
          <Notifications />
          <MemoryRouter initialEntries={[route]}>
            <BounceLogosProvider>{children}</BounceLogosProvider>
          </MemoryRouter>
        </MantineProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
