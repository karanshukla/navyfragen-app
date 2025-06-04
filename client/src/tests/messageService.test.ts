import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../api/apiClient";
import { messageService } from "../api/messageService";

// Mock dependencies
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

// Skip React Query hooks testing since it requires complex setup

describe("messageService", () => {
  // Mock data
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
      // Setup mock implementation
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockMessagesResponse);

      // Call the service
      const result = await messageService.getMessages(mockDid);

      // Verify the result
      expect(result).toEqual(mockMessagesResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/messages/${encodeURIComponent(mockDid)}`
      );
    });

    it("should handle errors", async () => {
      // Setup mock implementation for error
      const mockError = { error: "Not found", status: 404 };
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      // Call the service and expect it to throw
      await expect(messageService.getMessages(mockDid)).rejects.toEqual(
        mockError
      );
    });
  });

  describe("sendMessage", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockSendMessageResponse);

      // Call the service
      const result = await messageService.sendMessage(mockSendMessageRequest);

      // Verify the result
      expect(result).toEqual(mockSendMessageResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/messages/send",
        mockSendMessageRequest
      );
    });
  });

  describe("deleteMessage", () => {
    it("should call apiClient.delete with the correct endpoint", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ success: true });

      // Call the service
      const tid = "tid1";
      const result = await messageService.deleteMessage(tid);

      // Verify the result
      expect(result).toEqual({ success: true });
      expect(apiClient.delete).toHaveBeenCalledWith(`/messages/${tid}`);
    });
  });

  describe("respondToMessage", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.post).mockResolvedValueOnce(
        mockResponseMessageResponse
      );

      // Call the service
      const result = await messageService.respondToMessage(
        mockResponseMessageRequest
      );

      // Verify the result
      expect(result).toEqual(mockResponseMessageResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/messages/respond",
        mockResponseMessageRequest
      );
    });
  });

  describe("addExampleMessages", () => {
    it("should call apiClient.post with the correct endpoint and data", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockMessagesResponse);

      // Call the service
      const result = await messageService.addExampleMessages(mockDid);

      // Verify the result
      expect(result).toEqual(mockMessagesResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/messages/example", {
        recipient: mockDid,
      });
    });
  });

  describe("syncMessages", () => {
    it("should call apiClient.post with the correct endpoint", async () => {
      // Setup mock implementation
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockMessagesResponse);

      // Call the service
      const result = await messageService.syncMessages();

      // Verify the result
      expect(result).toEqual(mockMessagesResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/messages/sync");
    });
  });
});
