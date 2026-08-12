import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { apiClient } from "../api/apiClient";
import {
  messageService,
  useMessages,
  useSendMessage,
  useDeleteMessage,
  useRespondToMessage,
  useAddExampleMessages,
  useSyncMessages,
  useStartRender,
  useRenderStatus,
  messageKeys,
  renderPollInterval,
  RENDER_POLL_FAST_MS,
  RENDER_POLL_FAST_POLLS,
  RENDER_POLL_SLOW_MS,
} from "../api/messageService";
import { settingsKeys } from "../api/settingsService";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return Wrapper;
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
      expect(apiClient.get).toHaveBeenCalledWith(`/messages/${encodeURIComponent(mockDid)}`);
    });

    it("should handle errors", async () => {
      const mockError = { error: "Not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      await expect(messageService.getMessages(mockDid)).rejects.toEqual(mockError);
    });
  });

  describe("sendMessage", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockSendMessageResponse);

      const result = await messageService.sendMessage(mockSendMessageRequest);

      expect(result).toEqual(mockSendMessageResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/messages/send", mockSendMessageRequest);
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
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponseMessageResponse);

      const requestWithImage = {
        ...mockResponseMessageRequest,
        includeQuestionAsImage: true,
      };
      const result = await messageService.respondToMessage(requestWithImage);

      expect(result).toEqual(mockResponseMessageResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/messages/respond", requestWithImage);
    });

    it("should call apiClient.post with the correct endpoint and data when includeQuestionAsImage is false", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponseMessageResponse);

      const requestWithoutImage = {
        ...mockResponseMessageRequest,
        includeQuestionAsImage: false,
      };
      const result = await messageService.respondToMessage(requestWithoutImage);

      expect(result).toEqual(mockResponseMessageResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/messages/respond", requestWithoutImage);
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

  describe("render endpoints", () => {
    it("startRender posts the question the render is for", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ renderId: "r1", status: "pending" });

      const result = await messageService.startRender({
        tid: "tid1",
        original: "Original message",
        theme: "sunset",
      });

      expect(result).toEqual({ renderId: "r1", status: "pending" });
      expect(apiClient.post).toHaveBeenCalledWith("/messages/render", {
        tid: "tid1",
        original: "Original message",
        theme: "sunset",
      });
    });

    it("getRenderStatus reads the render key back, escaped into the path", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ status: "ready" });

      const result = await messageService.getRenderStatus("a/b");

      expect(result).toEqual({ status: "ready" });
      expect(apiClient.get).toHaveBeenCalledWith("/messages/render/a%2Fb");
    });
  });

  describe("messageKeys", () => {
    /**
     * Invalidation matches by prefix, so this is the boundary that keeps every
     * message mutation from force-refetching a live render poll. Both terminal
     * render statuses are read-once on the server, so a forced refetch reads
     * `unknown` and queues a fresh Chromium render for an answered question.
     */
    it("a message invalidation refreshes the message list", async () => {
      const qc = new QueryClient();
      const listKey = messageKeys.detail("did:plc:abc");
      qc.setQueryData(listKey, { messages: [] });

      await qc.invalidateQueries({ queryKey: messageKeys.all });

      expect(qc.getQueryState(listKey)?.isInvalidated).toBe(true);
    });

    it("a message invalidation leaves a live render poll alone", async () => {
      const qc = new QueryClient();
      const renderKey = messageKeys.render("render-abc", 0);
      qc.setQueryData(renderKey, { status: "ready" });

      await qc.invalidateQueries({ queryKey: messageKeys.all });

      expect(qc.getQueryState(renderKey)?.isInvalidated).toBe(false);
    });

    it("parks a poll with no key to read outside the message list namespace", async () => {
      const qc = new QueryClient();
      qc.setQueryData(messageKeys.noRender, { status: "pending" });

      await qc.invalidateQueries({ queryKey: messageKeys.all });

      expect(qc.getQueryState(messageKeys.noRender)?.isInvalidated).toBe(false);
    });
  });

  describe("renderPollInterval", () => {
    it("polls fast for the last poll before the back-off boundary", () => {
      expect(renderPollInterval("rendering", RENDER_POLL_FAST_POLLS - 1)).toBe(RENDER_POLL_FAST_MS);
    });

    it("backs off once the boundary is reached", () => {
      expect(renderPollInterval("rendering", RENDER_POLL_FAST_POLLS)).toBe(RENDER_POLL_SLOW_MS);
    });

    it("polls fast before the first result has arrived", () => {
      expect(renderPollInterval(undefined, 0)).toBe(RENDER_POLL_FAST_MS);
    });

    it("keeps polling while the render is still pending", () => {
      expect(renderPollInterval("pending", 0)).toBe(RENDER_POLL_FAST_MS);
    });

    it("stops on every status that has nothing left to wait for", () => {
      expect(renderPollInterval("ready", 0)).toBe(false);
      expect(renderPollInterval("failed", 0)).toBe(false);
      expect(renderPollInterval("unknown", 0)).toBe(false);
    });

    it("keeps polling a render still in flight that has answered every poll", () => {
      expect(renderPollInterval("rendering", 0, false)).toBe(RENDER_POLL_FAST_MS);
    });

    it("stops once the poll itself is failing, rather than retrying forever", () => {
      expect(renderPollInterval("rendering", 0, true)).toBe(false);
      expect(renderPollInterval(undefined, 0, true)).toBe(false);
    });
  });

  describe("warmImageService", () => {
    it("posts to the warm endpoint", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ ok: true });
      await messageService.warmImageService();
      expect(apiClient.post).toHaveBeenCalledWith("/messages/warm-image");
    });

    it("resolves even when the warm request fails, so a hint never surfaces an error", async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("offline"));
      await expect(messageService.warmImageService()).resolves.toBeUndefined();
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
    const { result } = renderHook(() => useMessages(mockDid), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("useMessages with null did returns a query result", () => {
    const { result } = renderHook(() => useMessages(null), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useSendMessage returns a mutation object", () => {
    const { result } = renderHook(() => useSendMessage(), {
      wrapper: makeWrapper(),
    });
    expect(typeof result.current.mutate).toBe("function");
  });

  it("useSendMessage.mutationFn calls messageService.sendMessage", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useSendMessage(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        recipient: "did:example:1",
        message: "Test",
      });
    });
    expect(apiClient.post).toHaveBeenCalledWith("/messages/send", expect.any(Object));
  });

  it("useDeleteMessage.onSuccess invalidates messages and stats", async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useDeleteMessage(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync("tid-1");
    });
    const { queryClient: qc } = await import("../api/queryClient");
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({
      queryKey: messageKeys.all,
    });
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({
      queryKey: settingsKeys.stats(),
    });
  });

  it("useRespondToMessage.onSuccess invalidates messages and stats", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useRespondToMessage(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        tid: "t1",
        recipient: mockDid,
        original: "Q",
        response: "A",
      });
    });
    const { queryClient: qc } = await import("../api/queryClient");
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({
      queryKey: messageKeys.all,
    });
  });

  it("useAddExampleMessages.onSuccess invalidates queries", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ messages: [] });
    const { result } = renderHook(() => useAddExampleMessages(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync(mockDid);
    });
    const { queryClient: qc } = await import("../api/queryClient");
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({
      queryKey: messageKeys.all,
    });
  });

  it("useStartRender.mutationFn calls messageService.startRender", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ renderId: "r1", status: "pending" });
    const { result } = renderHook(() => useStartRender(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({ tid: "t1", original: "Q" });
    });
    expect(apiClient.post).toHaveBeenCalledWith("/messages/render", {
      tid: "t1",
      original: "Q",
    });
  });

  it("useRenderStatus polls the render key it was given", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: "pending" });
    const { result } = renderHook(() => useRenderStatus("r1", 0), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toEqual({ status: "pending" }));
    expect(apiClient.get).toHaveBeenCalledWith("/messages/render/r1");
  });

  it("useRenderStatus stays idle until there is a key to poll", () => {
    const { result } = renderHook(() => useRenderStatus(null, 0), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useSyncMessages.onSuccess invalidates queries", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ messages: [] });
    const { result } = renderHook(() => useSyncMessages(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });
    const { queryClient: qc } = await import("../api/queryClient");
    expect(vi.mocked(qc.invalidateQueries)).toHaveBeenCalledWith({
      queryKey: messageKeys.all,
    });
  });
});
