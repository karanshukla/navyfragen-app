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
  exists: boolean;
}

export interface UserExistsResponse {
  exists: boolean;
  did?: string;
}

export interface ResolveHandleResponse {
  did: string;
}

export interface Friend {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface FriendsResponse {
  moots: Friend[];
  following: Friend[];
  oomfs: Friend[];
}

export interface BotFollowResponse {
  following: boolean;
}

// Query keys
export const profileKeys = {
  all: ["profiles"] as const,
  exists: (did: string) => [...profileKeys.all, "exists", did] as const,
  detail: (did: string) => [...profileKeys.all, did] as const,
  resolveHandle: (handle: string) =>
    [...profileKeys.all, "resolve", handle] as const,
  friends: (did: string) => [...profileKeys.all, "friends", did] as const,
  botFollow: () => [...profileKeys.all, "bot-follow"] as const,
};

// API Services
export const profileService = {
  // Get follows who are on Navyfragen
  getFriends: (): Promise<FriendsResponse> =>
    apiClient.get<FriendsResponse>("/friends"),


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

  // Check if the logged-in user follows the notification bot
  checkBotFollow: (): Promise<BotFollowResponse> =>
    apiClient.get<BotFollowResponse>("/check-bot-follow"),

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
        : /* v8 ignore next */ Promise.reject("No DID provided"),
    enabled: !!did,
  });
}

export function useUserExists(did: string | null) {
  return useQuery({
    queryKey: did ? profileKeys.exists(did) : profileKeys.all,
    queryFn: () =>
      did
        ? profileService.userExists(did)
        : /* v8 ignore next */ Promise.reject("No DID provided"),
    enabled: !!did, // Only run if DID is provided
  });
}

const ONE_DAY = 24 * 60 * 60 * 1000;

function getFriendsCacheKey(did: string) {
  return `navyfragen_friends_v3_cache_${did}`;
}

function getCachedFriends(did: string): { data: FriendsResponse; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(getFriendsCacheKey(did));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useFriends(did: string | null) {
  return useQuery({
    queryKey: did ? profileKeys.friends(did) : profileKeys.all,
    queryFn: async () => {
      const data = await profileService.getFriends();
      try {
        localStorage.setItem(
          getFriendsCacheKey(did!),
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } catch {
        /* v8 ignore next */ // localStorage unavailable (private browsing quota, etc.)
      }
      return data;
    },
    enabled: !!did,
    staleTime: ONE_DAY,
    // Read localStorage lazily — only when the query cache entry is first created,
    // not on every render.
    initialData: () => (did ? getCachedFriends(did)?.data : undefined) ?? undefined,
    /* v8 ignore start */
    initialDataUpdatedAt: () => (did ? getCachedFriends(did)?.timestamp : undefined) ?? undefined,
    /* v8 ignore stop */
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useBotFollow(enabled: boolean) {
  return useQuery({
    queryKey: profileKeys.botFollow(),
    queryFn: () => profileService.checkBotFollow(),
    enabled,
    // staleTime: 0 so the query is always stale — combined with the global
    // refetchOnWindowFocus:true, this means returning from the Bluesky tab
    // immediately triggers a background refetch to pick up the new follow.
    staleTime: 0,
    retry: false,
  });
}

export function useResolveHandle(handle: string | null) {
  return useQuery({
    queryKey: handle ? profileKeys.resolveHandle(handle) : profileKeys.all,
    queryFn: () =>
      handle
        ? profileService.resolveHandle(handle)
        : /* v8 ignore next */ Promise.reject("No handle provided"),
    enabled: !!handle,
  });
}
