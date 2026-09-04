import { useQuery } from "@tanstack/react-query";

import { STORAGE_PREFIX } from "../lib/contracts";
import { readStoredJson, writeStoredJson, removeStored } from "../lib/safeLocalStorage";

import { apiClient } from "./apiClient";
import type { AtmosphereAppLink } from "../lib/atmosphereApps";

import type { AskCardCustomisation } from "./settingsService";

/** @see {@link https://docs.bsky.app/docs/api/app-bsky-actor-get-profile} */
export interface ProfileResponse extends Partial<AskCardCustomisation> {
  profile: {
    did?: string;
    handle?: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
  } | null;
  exists: boolean;
  inboxEnabled?: boolean; // true unless the owner explicitly closed their inbox
  /** The other Atmosphere apps this account publishes to, named and addressed. */
  atmosphereApps?: AtmosphereAppLink[];
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

export const profileKeys = {
  all: ["profiles"] as const,
  exists: (did: string) => [...profileKeys.all, "exists", did] as const,
  detail: (did: string) => [...profileKeys.all, did] as const,
  resolveHandle: (handle: string) => [...profileKeys.all, "resolve", handle] as const,
  friends: (did: string) => [...profileKeys.all, "friends", did] as const,
  botFollow: () => [...profileKeys.all, "bot-follow"] as const,
};

export const profileService = {
  getFriends: (): Promise<FriendsResponse> => apiClient.get<FriendsResponse>("/friends"),

  getPublicProfile: (did: string): Promise<ProfileResponse> => {
    return apiClient.get<ProfileResponse>(`/public-profile/${encodeURIComponent(did)}`);
  },

  userExists: (did: string): Promise<UserExistsResponse> => {
    return apiClient.get<UserExistsResponse>(`/user-exists/${encodeURIComponent(did)}`);
  },

  checkBotFollow: (): Promise<BotFollowResponse> =>
    apiClient.get<BotFollowResponse>("/check-bot-follow"),

  resolveHandle: (handle: string): Promise<ResolveHandleResponse> => {
    return apiClient.get<ResolveHandleResponse>(`/resolve-handle/${encodeURIComponent(handle)}`);
  },
};

export function usePublicProfile(did: string | null) {
  return useQuery({
    queryKey: did ? profileKeys.detail(did) : profileKeys.all,
    queryFn: () =>
      did
        ? profileService.getPublicProfile(did)
        : /* istanbul ignore next */ Promise.reject("No DID provided" /* i18n-allow */),
    enabled: !!did,
    staleTime: 30 * 60 * 1000,
  });
}

export function useUserExists(did: string | null) {
  return useQuery({
    queryKey: did ? profileKeys.exists(did) : profileKeys.all,
    queryFn: () =>
      did
        ? profileService.userExists(did)
        : /* istanbul ignore next */ Promise.reject("No DID provided" /* i18n-allow */),
    enabled: !!did,
  });
}

const ONE_DAY = 24 * 60 * 60 * 1000;

function getFriendsCacheKey(did: string) {
  return `${STORAGE_PREFIX}_friends_v3_cache_${did}`;
}

export function clearFriendsCache(did: string) {
  removeStored(getFriendsCacheKey(did));
}

function getCachedFriends(did: string): { data: FriendsResponse; timestamp: number } | null {
  return readStoredJson<{ data: FriendsResponse; timestamp: number }>(getFriendsCacheKey(did));
}

export function useFriends(did: string | null) {
  return useQuery({
    queryKey: did ? profileKeys.friends(did) : profileKeys.all,
    queryFn: async () => {
      const data = await profileService.getFriends();
      writeStoredJson(getFriendsCacheKey(did!), { data, timestamp: Date.now() });
      return data;
    },
    enabled: !!did,
    staleTime: ONE_DAY,
    // Lazy: only when the cache entry is first created, not on every render.
    initialData: () => (did ? getCachedFriends(did)?.data : undefined) ?? undefined,
    // React Query only calls this when initialData returned a value, which
    // already implies `did` is set and the cache hit — so both the ternary's
    // alternate and the `?? undefined` fallback are unreachable from here.
    initialDataUpdatedAt: () => {
      /* istanbul ignore next */
      return (did ? getCachedFriends(did)?.timestamp : undefined) ?? undefined;
    },
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useBotFollow(enabled: boolean) {
  return useQuery({
    queryKey: profileKeys.botFollow(),
    queryFn: () => profileService.checkBotFollow(),
    enabled,
    // Always stale, so returning from the Bluesky tab refetches immediately
    // (via the global refetchOnWindowFocus) and picks up a brand-new follow.
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
        : /* istanbul ignore next */ Promise.reject("No handle provided" /* i18n-allow */),
    enabled: !!handle,
    staleTime: Infinity,
  });
}
