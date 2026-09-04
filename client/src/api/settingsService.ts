import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient, ApiError } from "./apiClient";
import { queryClient } from "./queryClient";

/**
 * What the owner has changed about their ask card, in the shape both the
 * settings API and a public profile return it. `null` means "not customised":
 * the app's own headline, its default gradient, and English touchpoints.
 */
export interface AskCardCustomisation {
  customPrompt: string | null;
  profileCardTheme: string | null;
  touchpointLocale: string | null;
}

export interface UserSettings extends AskCardCustomisation {
  did: string;
  pdsSyncEnabled: number | boolean;
  imageTheme: string;
  inboxEnabled: number | boolean;
  profanityFilterEnabled: number | boolean;
  /** The logged-in user's own app language. Private — never returned on a public profile. */
  uiLocale: string | null;
  /**
   * The Atmosphere client, by Aturi waypoint id, that this user's answers link
   * to. Null keeps the Bluesky link the server posted. Private, like uiLocale.
   */
  defaultClient: string | null;
  createdAt: string;
}

export interface UserStats {
  messageCount: number;
  memberSince: string | null;
}

export interface PdsInfo {
  pdsUrl: string | null;
  recordCount: number;
}

export const settingsKeys = {
  all: ["settings"] as const,
  user: () => [...settingsKeys.all, "user"] as const,
  stats: () => [...settingsKeys.all, "stats"] as const,
  pdsInfo: () => [...settingsKeys.all, "pds-info"] as const,
};

export const settingsService = {
  getUserSettings: async (): Promise<UserSettings> => {
    return apiClient.get<UserSettings>("/settings");
  },

  updateUserSettings: async (settings: Partial<UserSettings>): Promise<UserSettings> => {
    return apiClient.post<UserSettings, Partial<UserSettings>>("/settings", settings);
  },

  getStats: async (): Promise<UserStats> => {
    return apiClient.get<UserStats>("/stats");
  },

  getPdsInfo: async (): Promise<PdsInfo> => {
    return apiClient.get<PdsInfo>("/pds-info");
  },
};

export function useUserSettings() {
  return useQuery<UserSettings, ApiError>({
    queryKey: settingsKeys.user(),
    queryFn: () => settingsService.getUserSettings(),
    retry: (failureCount, error) => {
      if (error.status === 404 || error.status === 401 || error.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
    // Every mutation invalidates settingsKeys.all, so a background refetch
    // between user actions would only duplicate work.
    staleTime: Infinity,
  });
}

export function useUserStats() {
  return useQuery<UserStats, ApiError>({
    queryKey: settingsKeys.stats(),
    queryFn: () => settingsService.getStats(),
    retry: false,
    refetchOnWindowFocus: false,
    // Invalidated by both message and settings mutations already.
    staleTime: Infinity,
  });
}

export function usePdsInfo() {
  return useQuery<PdsInfo, ApiError>({
    queryKey: settingsKeys.pdsInfo(),
    queryFn: () => settingsService.getPdsInfo(),
    retry: false,
    refetchOnWindowFocus: false,
    // Static per user; settings mutations invalidate it.
    staleTime: Infinity,
  });
}

export function useUpdateUserSettings(options?: {
  onSuccess?: () => void;
  onError?: (error: ApiError) => void;
}) {
  return useMutation({
    mutationFn: (settings: Partial<UserSettings>) => settingsService.updateUserSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}
