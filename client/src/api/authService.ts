import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";

import { apiClient, ApiError } from "./apiClient";
import { clearFriendsCache } from "./profileService";
import { queryClient } from "./queryClient";

/** @see {@link https://docs.bsky.app/docs/api/app-bsky-actor-get-profile} */
export interface UserProfile {
  did?: string;
  handle?: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
}

/** Read-only mirror of the server's `AccountEntry`; switching goes via POST. */
export interface AccountEntry {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

export interface SessionResponse {
  isLoggedIn: boolean;
  profile: UserProfile | null;
  did: string | null;
  /** All accounts authenticated in this browser session (multi-account). */
  accounts?: AccountEntry[];
}

export interface LoginRequest {
  handle: string;
}

export interface LoginResponse {
  redirectUrl: string;
}

export interface SwitchAccountRequest {
  did: string;
}

export interface SwitchAccountResponse {
  success: boolean;
  did: string;
}

export interface E2ELoginRequest {
  identifier: string;
  password: string;
}

export interface E2ELoginResponse {
  success: boolean;
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

  switchAccount: async (data: SwitchAccountRequest): Promise<SwitchAccountResponse> => {
    return apiClient.post<SwitchAccountResponse, SwitchAccountRequest>("/accounts/switch", data);
  },

  e2eLogin: async (data: E2ELoginRequest): Promise<E2ELoginResponse> => {
    return apiClient.post<E2ELoginResponse, E2ELoginRequest>("/auth/e2e-login", data);
  },
};

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
      queryClient.invalidateQueries({ queryKey: authKeys.session });
      window.location.href = "/";
    },
  });
}

export function useSwitchAccount() {
  return useMutation<SwitchAccountResponse, ApiError, SwitchAccountRequest>({
    mutationFn: (data: SwitchAccountRequest) => authService.switchAccount(data),
    onSuccess: (response) => {
      clearFriendsCache(response.did);
    },
  });
}

export function useE2ELogin() {
  return useMutation({
    mutationFn: (data: E2ELoginRequest) => authService.e2eLogin(data),
  });
}
