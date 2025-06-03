import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import { apiClient, ApiError } from "./apiClient";
import { queryClient } from "./queryClient";

/**
 * Represents a user profile on the client-side.
 * This interface is based on the app.bsky.actor.getProfile lexicon.
 * @see {@link https://docs.bsky.app/docs/api/app-bsky-actor-get-profile}
 */
export interface UserProfile {
  did?: string;
  handle?: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
}

export interface SessionResponse {
  isLoggedIn: boolean;
  profile: UserProfile | null;
  did: string | null;
}

export interface LoginRequest {
  handle: string;
}

export interface LoginResponse {
  redirectUrl: string;
}

export const authKeys = {
  session: ["auth", "session"] as const,
};

export const authService = {
  getSession: (): Promise<SessionResponse> => {
    return apiClient.get<SessionResponse>("/session");
  },

  login: async (data: LoginRequest): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse, LoginRequest>("/login", data);
  },

  logout: async (): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>("/logout");
  },
};

// React Query hooks
export function useSession(): UseQueryResult<SessionResponse, ApiError> {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: () => authService.getSession(),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Invalidate the session query to force a refetch
      queryClient.invalidateQueries({ queryKey: authKeys.session });
      window.location.href = "/";
    },
  });
}
