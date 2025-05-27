// Authentication and user session related types, hooks, and services
import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import { apiClient, ApiError } from "./apiClient";
import { queryClient } from "./queryClient";

// Type definitions
export interface UserProfile {
  did?: string;
  handle?: string;
  displayName?: string;
  description?: string;
  avatar?: string;
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

// Query keys
export const authKeys = {
  session: ["auth", "session"] as const,
};

// API Services
export const authService = {
  // Get current session
  getSession: (): Promise<SessionResponse> => {
    return apiClient.get<SessionResponse>("/session");
  },

  // Initialize login flow
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse, LoginRequest>("/login", data);
  },

  // Logout user
  logout: async (): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>("/logout");
  },
};

// React Query hooks
export function useSession(): UseQueryResult<SessionResponse, ApiError> {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: () => authService.getSession(),
    staleTime: 60 * 1000, // 1 minute (shorter than default)
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
      // Remove localStorage token in local dev
      if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        localStorage.removeItem("auth_token");
      }
      // Redirect to home after logout
      window.location.href = "/";
    },
  });
}
