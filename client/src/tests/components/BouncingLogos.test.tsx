import { act, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BounceLogosProvider } from "../../components/BounceLogosContext";
import { BouncingLogos } from "../../components/BouncingLogos";
import { BOX_MAX_WIDTH, MIN_GAP_PX } from "../../lib/bounceLogos";

const STORAGE_KEY = "nf-bounce-logos-enabled";
// Wide enough that even the largest variant (64px) fits with room to bounce.
const WIDE_WIDTH = BOX_MAX_WIDTH + MIN_GAP_PX * 6;
const WIDE_HEIGHT = 1440;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
    writable: true,
  });
}

function mockReducedMotion(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches,
  } as MediaQueryList);
}

function renderWithBounceProvider(stored: "true" | "false" | null = "true") {
  if (stored === null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, stored);
  }
  return render(
    <BounceLogosProvider>
      <BouncingLogos />
    </BounceLogosProvider>
  );
}

describe("BouncingLogos", () => {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;

  beforeEach(() => {
    mockReducedMotion(false);
    setViewport(WIDE_WIDTH, WIDE_HEIGHT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setViewport(originalWidth, originalHeight);
  });

  it("renders nothing when the feature is disabled", () => {
    renderWithBounceProvider("false");
    expect(screen.queryAllByTestId("bouncing-logo")).toHaveLength(0);
  });

  it("renders nothing when the user prefers reduced motion", () => {
    mockReducedMotion(true);
    renderWithBounceProvider("true");
    expect(screen.queryAllByTestId("bouncing-logo")).toHaveLength(0);
  });

  it("renders nothing when the viewport is too narrow for a gap", () => {
    setViewport(BOX_MAX_WIDTH, WIDE_HEIGHT);
    renderWithBounceProvider("true");
    expect(screen.queryAllByTestId("bouncing-logo")).toHaveLength(0);
  });

  it("renders one logo per variant on each side when enabled with enough room", () => {
    renderWithBounceProvider("true");
    // 3 variants x 2 sides
    expect(screen.queryAllByTestId("bouncing-logo")).toHaveLength(6);
  });

  it("stops rendering logos after a resize makes the viewport too narrow", () => {
    renderWithBounceProvider("true");
    expect(screen.queryAllByTestId("bouncing-logo")).toHaveLength(6);

    act(() => {
      setViewport(BOX_MAX_WIDTH, WIDE_HEIGHT);
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.queryAllByTestId("bouncing-logo")).toHaveLength(0);
  });

  it("removes the resize listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderWithBounceProvider("true");
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("animates position via requestAnimationFrame and cancels on unmount", () => {
    const frames: FrameRequestCallback[] = [];
    let nextId = 0;
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      nextId += 1;
      return nextId;
    });
    const cafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { unmount } = renderWithBounceProvider("true");

    // Each of the six logos schedules its first frame on mount.
    expect(frames).toHaveLength(6);

    const logos = screen.getAllByTestId("bouncing-logo");
    const initialTransform = logos[0].style.transform;

    // First invocation only records the timestamp (no delta yet) and reschedules.
    act(() => {
      frames[0](1000);
    });
    expect(logos[0].style.transform).toBe(initialTransform);
    expect(frames).toHaveLength(7);

    // Second invocation has a delta, so the logo should move.
    act(() => {
      frames[6](1100);
    });
    expect(logos[0].style.transform).not.toBe(initialTransform);

    unmount();
    expect(cafSpy).toHaveBeenCalledTimes(6);

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("applies the slow-spin class to the sparkle variant only", () => {
    renderWithBounceProvider("true");
    const spinning = document.querySelectorAll(".nf-bounce-spin");
    // One spin variant per side.
    expect(spinning).toHaveLength(2);
  });
});
