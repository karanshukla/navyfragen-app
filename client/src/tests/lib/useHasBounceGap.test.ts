import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BOX_MAX_WIDTH, MIN_GAP_PX } from "../../lib/bounceLogos";
import { useHasBounceGap } from "../../lib/useHasBounceGap";

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
    writable: true,
  });
}

describe("useHasBounceGap", () => {
  afterEach(() => {
    setViewport(originalWidth, originalHeight);
  });

  it("returns false on a narrow viewport", () => {
    setViewport(BOX_MAX_WIDTH, 1000);
    const { result } = renderHook(() => useHasBounceGap());
    expect(result.current).toBe(false);
  });

  it("returns true on a wide viewport", () => {
    setViewport(BOX_MAX_WIDTH + MIN_GAP_PX * 4, 1440);
    const { result } = renderHook(() => useHasBounceGap());
    expect(result.current).toBe(true);
  });

  it("updates when the window is resized", () => {
    setViewport(BOX_MAX_WIDTH, 1000);
    const { result } = renderHook(() => useHasBounceGap());
    expect(result.current).toBe(false);

    act(() => {
      setViewport(BOX_MAX_WIDTH + MIN_GAP_PX * 4, 1440);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(true);
  });

  it("removes the resize listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useHasBounceGap());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    removeSpy.mockRestore();
  });
});
