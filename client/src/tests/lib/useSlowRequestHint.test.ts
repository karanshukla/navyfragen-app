import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLOW_REQUEST_HINT_MS, useSlowRequestHint } from "../../lib/useSlowRequestHint";

describe("useSlowRequestHint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is false while inactive, however long it waits", () => {
    const { result } = renderHook(() => useSlowRequestHint(false));
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS * 10);
    });
    expect(result.current).toBe(false);
  });

  it("stays false just before the delay elapses", () => {
    const { result } = renderHook(() => useSlowRequestHint(true));
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS - 1);
    });
    expect(result.current).toBe(false);
  });

  it("becomes true once the delay elapses", () => {
    const { result } = renderHook(() => useSlowRequestHint(true));
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS);
    });
    expect(result.current).toBe(true);
  });

  it("honours a custom delay", () => {
    const { result } = renderHook(() => useSlowRequestHint(true, 50));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe(true);
  });

  it("resets when the request finishes, so the next one starts quiet", () => {
    const { result, rerender } = renderHook(({ active }) => useSlowRequestHint(active), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS);
    });
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it("does not fire for a request that finishes before the delay", () => {
    const { result, rerender } = renderHook(({ active }) => useSlowRequestHint(active), {
      initialProps: { active: true },
    });
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS * 2);
    });
    expect(result.current).toBe(false);
  });
});
