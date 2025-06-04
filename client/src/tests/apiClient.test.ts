import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, ApiError } from "../api/apiClient";

const originalFetch = window.fetch;

describe("apiClient", () => {
  beforeEach(() => {
    window.fetch = vi.fn() as any;
  });
  afterEach(() => {
    window.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe("get", () => {
    it("should make a GET request to the correct URL", async () => {
      window.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: "test data" }),
      });

      await apiClient.get("/test-endpoint");

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test-endpoint"),
        expect.objectContaining({
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    it("should throw an error when response is not ok", async () => {
      window.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Bad Request" }),
      });

      await expect(apiClient.get("/test-endpoint")).rejects.toEqual(
        expect.objectContaining({
          error: "Bad Request",
          status: 400,
        })
      );
    });
    it("should handle JSON parse errors", async () => {
      window.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      await expect(apiClient.get("/test-endpoint")).rejects.toEqual(
        expect.objectContaining({
          error: "Unknown error",
          status: 500,
        })
      );
    });
  });

  describe("post", () => {
    it("should make a POST request with correct data", async () => {
      window.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const testData = { name: "test" };

      await apiClient.post("/test-endpoint", testData);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test-endpoint"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testData),
        })
      );
    });
  });

  describe("delete", () => {
    it("should make a DELETE request with correct data", async () => {
      window.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const testData = { id: "123" };

      await apiClient.delete("/test-endpoint", testData);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test-endpoint"),
        expect.objectContaining({
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testData),
        })
      );
    });
  });
});
