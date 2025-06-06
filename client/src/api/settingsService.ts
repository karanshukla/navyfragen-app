import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "./apiClient";
import { queryClient } from "./queryClient";

// Types
export interface UserSettings {
  did: string;
  pdsSyncEnabled: number | boolean; // Server returns number (1/0), but we use as boolean
  createdAt: string;
}

// Query keys
export const settingsKeys = {
  all: ["settings"] as const,
  user: () => [...settingsKeys.all, "user"] as const,
};

// API Services
export const settingsService = {
  // Get user settings
  getUserSettings: async (): Promise<UserSettings> => {
    return apiClient.get<UserSettings>("/settings");
  },

  // Update user settings
  updateUserSettings: async (
    settings: Partial<UserSettings>
  ): Promise<UserSettings> => {
    return apiClient.post<UserSettings, Partial<UserSettings>>(
      "/settings",
      settings
    );
  },
};

// React Query hooks
export function useUserSettings() {
  return useQuery<UserSettings, ApiError>({
    queryKey: settingsKeys.user(),
    queryFn: () => settingsService.getUserSettings(),
    retry: (failureCount, error) => {
      // Don't retry on 404 (not found) or 401/403 (authentication) errors
      if (
        error.status === 404 ||
        error.status === 401 ||
        error.status === 403
      ) {
        return false;
      }
      // Otherwise retry up to 3 times
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
  });
}

export function useUpdateUserSettings(options?: {
  onSuccess?: () => void;
  onError?: (error: ApiError) => void;
}) {
  return useMutation({
    mutationFn: (settings: Partial<UserSettings>) =>
      settingsService.updateUserSettings(settings),
    onSuccess: () => {
      // Invalidate the settings query to refetch updated settings
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}
