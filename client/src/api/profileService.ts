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

export interface Friend {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface FriendsResponse {
  friends: Friend[];
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
  friends: () => [...profileKeys.all, "friends"] as const,
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

const ONE_DAY = 24 * 60 * 60 * 1000;
const FRIENDS_CACHE_KEY = "navyfragen_friends_cache";

function getCachedFriends(): { data: FriendsResponse; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(FRIENDS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useFriends(enabled: boolean) {
  const cached = getCachedFriends();
  return useQuery({
    queryKey: profileKeys.friends(),
    queryFn: async () => {
      const data = await profileService.getFriends();
      try {
        localStorage.setItem(
          FRIENDS_CACHE_KEY,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } catch {
        // localStorage unavailable (private browsing quota, etc.)
      }
      return data;
    },
    enabled,
    staleTime: ONE_DAY,
    initialData: cached?.data ?? undefined,
    initialDataUpdatedAt: cached?.timestamp ?? undefined,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useBotFollow(enabled: boolean) {
  return useQuery({
    queryKey: profileKeys.botFollow(),
    queryFn: () => profileService.checkBotFollow(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
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
