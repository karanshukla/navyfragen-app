// Keep in sync with the `.app-shell-boundary` max-width in index.css.
export const BOX_MAX_WIDTH = 1400;
export const LOGO_SIZE = 48;
export const MIN_GAP_PX = 192;

export const MARGIN = 32;
export const BASE_SPEED = 90;

export interface BounceBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface BounceState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GapBounds {
  left: BounceBounds;
  right: BounceBounds;
}

export function computeGapBounds(
  viewportWidth: number,
  viewportHeight: number,
  logoSize: number = LOGO_SIZE
): GapBounds | null {
  const gap = (viewportWidth - BOX_MAX_WIDTH) / 2;
  if (gap < MIN_GAP_PX) return null;

  const yMin = MARGIN;
  const yMax = viewportHeight - logoSize - MARGIN;
  if (yMax <= yMin) return null;

  const leftXMax = Math.max(MARGIN, gap - logoSize - MARGIN);
  const rightXMax = viewportWidth - logoSize - MARGIN;
  const rightXMin = Math.min(rightXMax, viewportWidth - gap + MARGIN);

  return {
    left: { xMin: MARGIN, xMax: leftXMax, yMin, yMax },
    right: { xMin: rightXMin, xMax: rightXMax, yMin, yMax },
  };
}

export function createInitialState(
  bounds: BounceBounds,
  seed: number,
  speedScale: number = 1
): BounceState {
  const xSpan = bounds.xMax - bounds.xMin;
  const ySpan = bounds.yMax - bounds.yMin;
  const speed = BASE_SPEED * speedScale;
  return {
    x: bounds.xMin + xSpan * (0.2 + 0.3 * (seed % 2)),
    y: bounds.yMin + ySpan * (0.3 + 0.2 * (seed % 3)),
    vx: seed % 2 === 0 ? speed : -speed,
    vy: seed % 3 === 0 ? speed * 0.7 : -speed * 0.7,
  };
}

export function stepBounce(
  state: BounceState,
  bounds: BounceBounds,
  dtSeconds: number
): BounceState {
  let { x, y, vx, vy } = state;
  x += vx * dtSeconds;
  y += vy * dtSeconds;

  if (x < bounds.xMin) {
    x = bounds.xMin;
    vx = Math.abs(vx);
  } else if (x > bounds.xMax) {
    x = bounds.xMax;
    vx = -Math.abs(vx);
  }

  if (y < bounds.yMin) {
    y = bounds.yMin;
    vy = Math.abs(vy);
  } else if (y > bounds.yMax) {
    y = bounds.yMax;
    vy = -Math.abs(vy);
  }

  return { x, y, vx, vy };
}
