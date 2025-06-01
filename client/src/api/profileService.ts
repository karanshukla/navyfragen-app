import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./apiClient";

/**
 * Represents a user profile on the client-side.
 * This interface is based on the app.bsky.actor.getProfile lexicon.
 * @see {@link https://docs.bsky.app/docs/api/app-bsky-actor-get-profile}
 */
export interface ProfileResponse {
  profile: {
    did?: string;
    handle?: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
  } | null;
}

export interface UserExistsResponse {
  exists: boolean;
  did?: string;
}

export interface ResolveHandleResponse {
  did: string;
}

// Query keys
export const profileKeys = {
  all: ["profiles"] as const,
  exists: (did: string) => [...profileKeys.all, "exists", did] as const,
  detail: (did: string) => [...profileKeys.all, did] as const,
  resolveHandle: (handle: string) =>
    [...profileKeys.all, "resolve", handle] as const,
};

// API Services
export const profileService = {
  // Get public profile by DID
  getPublicProfile: (did: string): Promise<ProfileResponse> => {
    return apiClient.get<ProfileResponse>(
      `/public-profile/${encodeURIComponent(did)}`
    );
  },

  // Check if user exists
  userExists: (did: string): Promise<UserExistsResponse> => {
    return apiClient.get<UserExistsResponse>(
      `/user-exists/${encodeURIComponent(did)}`
    );
  },

  // Resolve handle to DID
  resolveHandle: (handle: string): Promise<ResolveHandleResponse> => {
    return apiClient.get<ResolveHandleResponse>(
      `/resolve-handle/${encodeURIComponent(handle)}`
    );
  },
};

// React Query hooks
export function usePublicProfile(did: string | null) {
  return useQuery({
    queryKey: did ? profileKeys.detail(did) : profileKeys.all,
    queryFn: () =>
      did
        ? profileService.getPublicProfile(did)
        : Promise.reject("No DID provided"),
    enabled: !!did, // Only run if DID is provided
  });
}

export function useUserExists(did: string | null) {
  return useQuery({
    queryKey: did ? profileKeys.exists(did) : profileKeys.all,
    queryFn: () =>
      did ? profileService.userExists(did) : Promise.reject("No DID provided"),
    enabled: !!did, // Only run if DID is provided
  });
}

export function useResolveHandle(handle: string | null) {
  return useQuery({
    queryKey: handle ? profileKeys.resolveHandle(handle) : profileKeys.all,
    queryFn: () =>
      handle
        ? profileService.resolveHandle(handle)
        : Promise.reject("No handle provided"),
    enabled: !!handle, // Only run if handle is provided
  });
}
