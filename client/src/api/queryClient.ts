import { QueryClient } from "@tanstack/react-query";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES_MS,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
