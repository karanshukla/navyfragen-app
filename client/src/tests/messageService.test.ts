import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { apiClient } from "../api/apiClient";
import {
  messageService,
  useMessages,
  useSendMessage,
  useDeleteMessage,
  useRespondToMessage,
  useAddExampleMessages,
  useSyncMessages,
  messageKeys,
} from "../api/messageService";
import { settingsKeys } from "../api/settingsService";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

vi.mock("../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../api/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

describe("messageService", () => {
  const mockDid = "did:example:123";

  const mockMessages = [
    {
      tid: "tid1",
      message: "Hello world",
      createdAt: "2023-01-01T00:00:00.000Z",
      recipient: mockDid,
    },
    {
      tid: "tid2",
      message: "Another message",
      createdAt: "2023-01-02T00:00:00.000Z",
      recipient: mockDid,
    },
  ];

  const mockMessagesResponse = {
    messages: mockMessages,
  };

  const mockSendMessageRequest = {
    recipient: mockDid,
    message: "New message",
  };

  const mockSendMessageResponse = {
    success: true,
  };

  const mockResponseMessageRequest = {
    tid: "tid1",
    recipient: mockDid,
    original: "Original message",
    response: "Response message",
    includeQuestionAsImage: true, // Added new parameter
  };

  const mockResponseMessageResponse = {
    success: true,
    uri: "at://did:example:123/app.bsky.feed.post/123",
    link: "https://bsky.app/profile/example.bsky.social/post/123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getMessages", () => {
    it("should call apiClient.get with the correct endpoint and parameters", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockMessagesResponse);

      const result = await messageService.getMessages(mockDid);

      expect(result).toEqual(mockMessagesResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/messages/${encodeURIComponent(mockDid)}`
      );
    });

    it("should handle errors", async () => {
      const mockError = { error: "Not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      await expect(messageService.getMessages(mockDid)).rejects.toEqual(
        mockError
      );
    });
  });

  describe("sendMessage", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockSendMessageResponse);

      const result = await messageService.sendMessage(mockSendMessageRequest);

      expect(result).toEqual(mockSendMessageResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/messages/send",
        mockSendMessageRequest
      );
    });
  });

  describe("deleteMessage", () => {
    it("should call apiClient.delete with the correct endpoint", async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ success: true });

      const tid = "tid1";
      const result = await messageService.deleteMessage(tid);

      expect(result).toEqual({ success: true });
      expect(apiClient.delete).toHaveBeenCalledWith(`/messages/${tid}`);
    });
  });

  describe("respondToMessage", () => {
    it("should call apiClient.post with the correct endpoint and data when includeQuestionAsImage is true", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(
        mockResponseMessageResponse
      );

      const requestWithImage = {
        ...mockResponseMessageRequest,
        includeQuestionAsImage: true,
      };
      const result = await messageService.respondToMessage(requestWithImage);

      expect(result).toEqual(mockResponseMessageResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/messages/respond",
        requestWithImage
      );
    });

    it("should call apiClient.post with the correct endpoint and data when includeQuestionAsImage is false", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(
        mockResponseMessageResponse
      );

      const requestWithoutImage = {
        ...mockResponseMessageRequest,
        includeQuestionAsImage: false,
      };
      const result = await messageService.respondToMessage(requestWithoutImage);

      expect(result).toEqual(mockResponseMessageResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/messages/respond",
        requestWithoutImage
      );
    });
  });

  describe("addExampleMessages", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockMessagesResponse);

      const result = await messageService.addExampleMessages(mockDid);

      expect(result).toEqual(mockMessagesResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/messages/example", {
        recipient: mockDid,
      });
    });
  });

  describe("syncMessages", () => {
    it("should call apiClient.post with the correct endpoint", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockMessagesResponse);

      const result = await messageService.syncMessages();

      expect(result).toEqual(mockMessagesResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/messages/sync");
    });
  });
});

describe("message hooks", () => {
  const mockDid = "did:example:123";

  beforeEach(() => vi.clearAllMocks());

  it("useMessages returns a query result", () => {
    vi.mocked(apiClient.get).mockResolvedValue({ messages: [] });
    const { result } = renderHook(() => useMessages(mockDid), { wrapper: makeWrapper() });
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("useMessages with null did returns a query result", () => {
    const { result } = renderHook(() => useMessages(null), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useSendMessage returns a mutation object", () => {
    const { result } = renderHook(() => useSendMessage(), { wrapper: makeWrapper() });
    expect(typeof result.current.mutate).toBe("function");
  });

  it("useDeleteMessage.onSuccess invalidates messages and stats", async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useDeleteMessage(), { wrapper: makeWrapper() });
    await act(async () => { await result.current.mutateAsync("tid-1"); });
    const { queryClient: qc } = await import("../api/queryClient");
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({ queryKey: messageKeys.all });
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({ queryKey: settingsKeys.stats() });
  });

  it("useRespondToMessage.onSuccess invalidates messages and stats", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useRespondToMessage(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        tid: "t1", recipient: mockDid, original: "Q", response: "A",
      });
    });
    const { queryClient: qc } = await import("../api/queryClient");
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({ queryKey: messageKeys.all });
  });

  it("useAddExampleMessages.onSuccess invalidates queries", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ messages: [] });
    const { result } = renderHook(() => useAddExampleMessages(), { wrapper: makeWrapper() });
    await act(async () => { await result.current.mutateAsync(mockDid); });
    const { queryClient: qc } = await import("../api/queryClient");
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({ queryKey: messageKeys.all });
  });

  it("useSyncMessages.onSuccess invalidates queries", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ messages: [] });
    const { result } = renderHook(() => useSyncMessages(), { wrapper: makeWrapper() });
    await act(async () => { await result.current.mutateAsync(); });
    const { queryClient: qc } = await import("../api/queryClient");
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({ queryKey: messageKeys.all });
  });
});
