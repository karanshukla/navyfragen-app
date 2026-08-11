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

    it("should throw an error when POST response is not ok", async () => {
      window.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Bad Request" }),
      });

      await expect(apiClient.post("/test-endpoint", {})).rejects.toEqual(
        expect.objectContaining({ error: "Bad Request", status: 400 })
      );
    });

    it("should handle JSON parse errors on POST failure", async () => {
      window.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      await expect(apiClient.post("/test-endpoint")).rejects.toEqual(
        expect.objectContaining({ error: "Unknown error", status: 500 })
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

    it("should throw an error when DELETE response is not ok", async () => {
      window.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not Found" }),
      });

      await expect(apiClient.delete("/test-endpoint")).rejects.toEqual(
        expect.objectContaining({ error: "Not Found", status: 404 })
      );
    });

    it("should handle JSON parse errors on DELETE failure", async () => {
      window.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      await expect(apiClient.delete("/test-endpoint")).rejects.toEqual(
        expect.objectContaining({ error: "Unknown error", status: 500 })
      );
    });
  });

  // API_URL is resolved once at module load, so each case re-imports the module
  // under a stubbed env rather than relying on whatever the ambient one is. A
  // local client/.env setting VITE_API_URL would otherwise decide which of the
  // two branches ran, and the other would read as dead code.
  describe("API base URL", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    async function loadApiClientWith(apiUrl: string | undefined) {
      vi.resetModules();
      vi.stubEnv("VITE_API_URL", apiUrl);
      return (await import("../api/apiClient")).apiClient;
    }

    function captureFetchUrl() {
      window.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      return () => vi.mocked(window.fetch).mock.calls[0][0];
    }

    it("prefixes requests with VITE_API_URL when one is configured", async () => {
      const client = await loadApiClientWith("https://api.example.test");
      const url = captureFetchUrl();

      await client.get("/test-endpoint");

      expect(url()).toBe("https://api.example.test/test-endpoint");
    });

    it("falls back to same-origin when VITE_API_URL is unset", async () => {
      const client = await loadApiClientWith(undefined);
      const url = captureFetchUrl();

      await client.get("/test-endpoint");

      expect(url()).toBe("/test-endpoint");
    });
  });
});
