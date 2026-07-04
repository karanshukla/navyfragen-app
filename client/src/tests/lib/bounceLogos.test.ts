import { describe, expect, it } from "vitest";

import {
  BASE_SPEED,
  BOX_MAX_WIDTH,
  computeGapBounds,
  createInitialState,
  LOGO_SIZE,
  MARGIN,
  MIN_GAP_PX,
  stepBounce,
} from "../../lib/bounceLogos";

describe("computeGapBounds", () => {
  it("returns null when the viewport is too narrow for a gap", () => {
    expect(computeGapBounds(BOX_MAX_WIDTH, 1000)).toBeNull();
  });

  it("returns null when the gap is narrower than MIN_GAP_PX", () => {
    const width = BOX_MAX_WIDTH + MIN_GAP_PX; // gap = MIN_GAP_PX / 2, too small
    expect(computeGapBounds(width, 1000)).toBeNull();
  });

  it("returns null when the viewport is too short for vertical travel", () => {
    const width = BOX_MAX_WIDTH + MIN_GAP_PX * 2 + 100;
    expect(computeGapBounds(width, 40)).toBeNull();
  });

  it("returns left/right bounds for the default logo size when there is enough room", () => {
    const width = 2560;
    const height = 1440;
    const bounds = computeGapBounds(width, height);
    expect(bounds).not.toBeNull();
    const gap = (width - BOX_MAX_WIDTH) / 2;

    expect(bounds!.left.xMin).toBe(MARGIN);
    expect(bounds!.left.xMax).toBe(gap - LOGO_SIZE - MARGIN);
    expect(bounds!.right.xMax).toBe(width - LOGO_SIZE - MARGIN);
    expect(bounds!.right.xMin).toBe(width - gap + MARGIN);
    expect(bounds!.left.yMin).toBe(MARGIN);
    expect(bounds!.left.yMax).toBe(height - LOGO_SIZE - MARGIN);
    expect(bounds!.right.yMin).toBe(bounds!.left.yMin);
    expect(bounds!.right.yMax).toBe(bounds!.left.yMax);
  });

  it("shrinks bounds for a larger logo size", () => {
    const width = 2560;
    const height = 1440;
    const small = computeGapBounds(width, height, 32)!;
    const large = computeGapBounds(width, height, 64)!;
    expect(large.left.xMax).toBeLessThan(small.left.xMax);
    expect(large.left.yMax).toBeLessThan(small.left.yMax);
  });

  it("clamps xMax to xMin instead of going negative when the gap barely fits a large logo", () => {
    // gap is just above MIN_GAP_PX, but the logo is bigger than the gap allows.
    const width = BOX_MAX_WIDTH + MIN_GAP_PX * 2;
    const bounds = computeGapBounds(width, 1440, 200)!;
    expect(bounds.left.xMax).toBe(bounds.left.xMin);
    expect(bounds.right.xMin).toBe(bounds.right.xMax);
  });
});

describe("createInitialState", () => {
  it("places an even seed moving right/up-ish inside the bounds", () => {
    const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
    const state = createInitialState(bounds, 2);
    expect(state.vx).toBeGreaterThan(0);
    expect(state.x).toBeGreaterThanOrEqual(bounds.xMin);
    expect(state.x).toBeLessThanOrEqual(bounds.xMax);
    expect(state.y).toBeGreaterThanOrEqual(bounds.yMin);
    expect(state.y).toBeLessThanOrEqual(bounds.yMax);
  });

  it("places an odd seed moving left", () => {
    const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
    const state = createInitialState(bounds, 1);
    expect(state.vx).toBeLessThan(0);
  });

  it("gives vy a different sign depending on seed % 3", () => {
    const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
    expect(createInitialState(bounds, 3).vy).toBeGreaterThan(0);
    expect(createInitialState(bounds, 1).vy).toBeLessThan(0);
  });

  it("scales speed by speedScale", () => {
    const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
    const state = createInitialState(bounds, 2, 2);
    expect(Math.abs(state.vx)).toBe(BASE_SPEED * 2);
  });
});

describe("stepBounce", () => {
  const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };

  it("moves the point along its velocity when inside bounds", () => {
    const next = stepBounce({ x: 50, y: 50, vx: 10, vy: 10 }, bounds, 1);
    expect(next).toEqual({ x: 60, y: 60, vx: 10, vy: 10 });
  });

  it("clamps and reflects vx when crossing xMin", () => {
    const next = stepBounce({ x: 5, y: 50, vx: -20, vy: 0 }, bounds, 1);
    expect(next.x).toBe(bounds.xMin);
    expect(next.vx).toBe(20);
  });

  it("clamps and reflects vx when crossing xMax", () => {
    const next = stepBounce({ x: 95, y: 50, vx: 20, vy: 0 }, bounds, 1);
    expect(next.x).toBe(bounds.xMax);
    expect(next.vx).toBe(-20);
  });

  it("clamps and reflects vy when crossing yMin", () => {
    const next = stepBounce({ x: 50, y: 5, vx: 0, vy: -20 }, bounds, 1);
    expect(next.y).toBe(bounds.yMin);
    expect(next.vy).toBe(20);
  });

  it("clamps and reflects vy when crossing yMax", () => {
    const next = stepBounce({ x: 50, y: 95, vx: 0, vy: 20 }, bounds, 1);
    expect(next.y).toBe(bounds.yMax);
    expect(next.vy).toBe(-20);
  });
});
