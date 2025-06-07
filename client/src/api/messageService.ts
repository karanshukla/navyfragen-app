import {
  useMutation,
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { apiClient, ApiError } from "./apiClient";
import { queryClient } from "./queryClient";

// Defined in the DB schema in /server
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
}

export interface ResponseMessageResponse {
  success: boolean;
  uri?: string;
  link?: string;
}

// Query keys
export const messageKeys = {
  all: ["messages"] as const,
  detail: (did: string) => [...messageKeys.all, did] as const,
};

// API Services
export const messageService = {
  // Get messages for user
  getMessages: (did: string): Promise<MessagesResponse> => {
    return apiClient.get<MessagesResponse>(
      `/messages/${encodeURIComponent(did)}`
    );
  },

  // Send anonymous message
  sendMessage: async (
    data: SendMessageRequest
  ): Promise<{ success: boolean }> => {
    return apiClient.post<{ success: boolean }, SendMessageRequest>(
      "/messages/send",
      data
    );
  },

  // Delete a message
  deleteMessage: async (tid: string): Promise<{ success: boolean }> => {
    return apiClient.delete<{ success: boolean }>(`/messages/${tid}`);
  },

  // Respond to a message
  respondToMessage: async (
    data: ResponseMessageRequest
  ): Promise<ResponseMessageResponse> => {
    return apiClient.post<ResponseMessageResponse, ResponseMessageRequest>(
      "/messages/respond",
      data
    );
  },

  // Add example messages (for testing)
  addExampleMessages: async (recipient: string): Promise<MessagesResponse> => {
    return apiClient.post<MessagesResponse>("/messages/example", { recipient });
  },

  // Sync with user's repo
  syncMessages: async (): Promise<MessagesResponse> => {
    return apiClient.post<MessagesResponse>(`/messages/sync`);
  },
};

// React Query hooks
export function useMessages(
  did: string | null,
  options?: Omit<
    UseQueryOptions<MessagesResponse, ApiError>,
    "queryKey" | "queryFn"
  >
): UseQueryResult<MessagesResponse, ApiError> {
  return useQuery<MessagesResponse, ApiError>({
    queryKey: did ? messageKeys.detail(did) : messageKeys.all,
    queryFn: () =>
      did ? messageService.getMessages(did) : Promise.reject("No DID provided"),
    enabled: !!did, // Only run if DID is provided
    ...(options || {}),
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
    onSuccess: (_data, tid) => {
      // Update all message queries after successful deletion
      queryClient.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}

export function useRespondToMessage() {
  return useMutation({
    mutationFn: (data: ResponseMessageRequest) =>
      messageService.respondToMessage(data),
  });
}

export function useAddExampleMessages() {
  return useMutation({
    mutationFn: (recipient: string) =>
      messageService.addExampleMessages(recipient),
    onSuccess: () => {
      // Invalidate message queries to refresh the list
      queryClient.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}

export function useSyncMessages() {
  return useMutation({
    mutationFn: () => messageService.syncMessages(),
    onSuccess: (_data) => {},
  });
}
