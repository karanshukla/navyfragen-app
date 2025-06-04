import { describe, it, expect, vi } from "vitest";
import { queryClient } from "../api/queryClient";
import { QueryClient } from "@tanstack/react-query";

describe("queryClient", () => {
  it("should be an instance of QueryClient", () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });
  it("should have the correct default options", () => {
    // @ts-ignore - Accessing private property for testing
    const defaultOptions = queryClient.getDefaultOptions();

    expect(defaultOptions.queries).toEqual({
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: true,
      retry: 1,
    });
  });
  it("should have methods for cache manipulation", () => {
    expect(typeof queryClient.invalidateQueries).toBe("function");
    expect(typeof queryClient.getQueryData).toBe("function");
    expect(typeof queryClient.setQueryData).toBe("function");
  });
});
