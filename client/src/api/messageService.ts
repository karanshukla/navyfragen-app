import { useMutation, useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";

import { apiClient, ApiError } from "./apiClient";
import { queryClient } from "./queryClient";
import { settingsKeys } from "./settingsService";

export interface Message {
  tid: string;
  message: string;
  createdAt: string;
  recipient: string;
}

export interface MessagesResponse {
  messages: Message[];
}

export interface SendMessageRequest {
  recipient: string;
  message: string;
}

export interface ResponseMessageRequest {
  tid: string;
  recipient: string;
  original: string;
  response: string;
  includeQuestionAsImage?: boolean;
  replyTo?: { uri: string; cid: string };
  /** A render the server already holds; omitting it falls back to a sync render. */
  renderId?: string;
}

export interface ResponseMessageResponse {
  success: boolean;
  uri?: string;
  cid?: string;
  link?: string;
}

/**
 * Where a queued question-image render has got to. `unknown` means the key is
 * gone — expired, or lost to a deploy that moved the in-process store — which is
 * a reason to render again, not a failure.
 */
export type RenderStatus = "pending" | "rendering" | "ready" | "failed" | "unknown";

export interface StartRenderRequest {
  tid: string;
  original: string;
  theme?: string;
}

export interface StartRenderResponse {
  renderId: string;
  status: RenderStatus;
}

export interface RenderStatusResponse {
  status: RenderStatus;
  /** The specific failure, present only on `failed`. */
  error?: string;
}

/**
 * Deliberately not under `messageKeys.all`. Every message mutation invalidates
 * that key, and invalidation matches by prefix, so a nested render key would be
 * force-refetched by an unrelated send or delete. Both terminal statuses are
 * read-once on the server, so that refetch reads `unknown` and drives a fresh
 * Chromium render for a question the user has already answered.
 *
 * @see [messageService.test.ts](../tests/messageService.test.ts): pins that a
 * message invalidation matches the list key and leaves a live render poll alone.
 */
const RENDER_NAMESPACE = "message-render";

export const messageKeys = {
  all: ["messages"] as const,
  detail: (did: string) => [...messageKeys.all, did] as const,
  /**
   * `attempt` separates successive polls of the same render key. The key is a
   * content hash, so a re-render after a loss returns the *same* id, and without
   * this the fresh poll would read the previous attempt's terminal result and
   * conclude the same thing forever.
   */
  render: (renderId: string, attempt: number) => [RENDER_NAMESPACE, renderId, attempt] as const,
  /** Where a poll with no key to read parks, rather than on the message list. */
  noRender: [RENDER_NAMESPACE, "none"] as const,
};

/** Tight enough to catch a warm render, before easing off for a cold one. */
export const RENDER_POLL_FAST_MS = 1000;
export const RENDER_POLL_SLOW_MS = 3000;
/** Polls served at the fast cadence before backing off to the slow one. */
export const RENDER_POLL_FAST_POLLS = 5;

const RENDER_IN_PROGRESS: readonly RenderStatus[] = ["pending", "rendering"];

/**
 * How long to wait before polling a render again, or `false` once there is
 * nothing left to wait for — a settled render, or a poll the server is not
 * answering.
 *
 * A poll that errors never advances `dataUpdateCount`, so without the `errored`
 * stop the back-off never arrives and the fast cadence runs forever against a
 * per-IP limiter that several users behind one NAT already share.
 *
 * @see [messageService.test.ts](../tests/messageService.test.ts): pins both
 * sides of the back-off boundary, that every settled status stops the poll, and
 * that a failing poll stops rather than retrying at the fast cadence forever.
 */
export function renderPollInterval(
  status: RenderStatus | undefined,
  polls: number,
  errored = false
): number | false {
  if (errored) return false;
  if (status !== undefined && !RENDER_IN_PROGRESS.includes(status)) return false;
  return polls < RENDER_POLL_FAST_POLLS ? RENDER_POLL_FAST_MS : RENDER_POLL_SLOW_MS;
}

export const messageService = {
  getMessages: (did: string): Promise<MessagesResponse> => {
    return apiClient.get<MessagesResponse>(`/messages/${encodeURIComponent(did)}`);
  },

  sendMessage: async (data: SendMessageRequest): Promise<{ success: boolean }> => {
    return apiClient.post<{ success: boolean }, SendMessageRequest>("/messages/send", data);
  },

  deleteMessage: async (tid: string): Promise<{ success: boolean }> => {
    return apiClient.delete<{ success: boolean }>(`/messages/${tid}`);
  },

  respondToMessage: async (data: ResponseMessageRequest): Promise<ResponseMessageResponse> => {
    return apiClient.post<ResponseMessageResponse, ResponseMessageRequest>(
      "/messages/respond",
      data
    );
  },

  startRender: async (data: StartRenderRequest): Promise<StartRenderResponse> => {
    return apiClient.post<StartRenderResponse, StartRenderRequest>("/messages/render", data);
  },

  getRenderStatus: async (renderId: string): Promise<RenderStatusResponse> => {
    return apiClient.get<RenderStatusResponse>(`/messages/render/${encodeURIComponent(renderId)}`);
  },

  /**
   * @see [messageService.test.ts](../tests/messageService.test.ts) — pins that a
   * failed warm resolves quietly; it is a latency hint, and the render that
   * follows carries the real error handling.
   */
  warmImageService: async (): Promise<void> => {
    await apiClient.post("/messages/warm-image").catch(() => undefined);
  },

  addExampleMessages: async (recipient: string): Promise<MessagesResponse> => {
    return apiClient.post<MessagesResponse>("/messages/example", { recipient });
  },

  syncMessages: async (): Promise<MessagesResponse> => {
    return apiClient.post<MessagesResponse>(`/messages/sync`);
  },
};

export function useMessages(
  did: string | null,
  options?: Omit<UseQueryOptions<MessagesResponse, ApiError>, "queryKey" | "queryFn">
): UseQueryResult<MessagesResponse, ApiError> {
  return useQuery<MessagesResponse, ApiError>({
    queryKey: did ? messageKeys.detail(did) : messageKeys.all,
    queryFn: () =>
      did
        ? messageService.getMessages(did)
        : /* istanbul ignore next */ Promise.reject("No DID provided" /* i18n-allow */),
    enabled: !!did,
    ...(options || {}),
  });
}

export function useStartRender() {
  return useMutation({
    mutationFn: (data: StartRenderRequest) => messageService.startRender(data),
  });
}

export function useRenderStatus(
  renderId: string | null,
  attempt: number
): UseQueryResult<RenderStatusResponse, ApiError> {
  return useQuery<RenderStatusResponse, ApiError>({
    queryKey: renderId ? messageKeys.render(renderId, attempt) : messageKeys.noRender,
    queryFn: () =>
      renderId
        ? messageService.getRenderStatus(renderId)
        : /* istanbul ignore next */ Promise.reject("No renderId provided" /* i18n-allow */),
    enabled: !!renderId,
    staleTime: 0,
    // A settled render is read-once on the server: a focus refetch would clear a
    // failure the composer has not shown yet.
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      renderPollInterval(
        query.state.data?.status,
        query.state.dataUpdateCount,
        query.state.status === "error"
      ),
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: (data: SendMessageRequest) => messageService.sendMessage(data),
  });
}

export function useDeleteMessage() {
  return useMutation({
    mutationFn: (tid: string) => messageService.deleteMessage(tid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all });
      queryClient.invalidateQueries({ queryKey: settingsKeys.stats() });
    },
  });
}

export function useRespondToMessage() {
  return useMutation({
    mutationFn: (data: ResponseMessageRequest) => messageService.respondToMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all });
      queryClient.invalidateQueries({ queryKey: settingsKeys.stats() });
    },
  });
}

export function useAddExampleMessages() {
  return useMutation({
    mutationFn: (recipient: string) => messageService.addExampleMessages(recipient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all });
      queryClient.invalidateQueries({ queryKey: settingsKeys.stats() });
    },
  });
}

export function useSyncMessages() {
  return useMutation({
    mutationFn: () => messageService.syncMessages(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all });
      queryClient.invalidateQueries({ queryKey: settingsKeys.stats() });
    },
  });
}
