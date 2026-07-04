import { useEffect, useRef, useState } from "react";

import {
  type BounceBounds,
  type BounceState,
  computeGapBounds,
  createInitialState,
  stepBounce,
} from "../lib/bounceLogos";

import { useBounceLogos } from "./BounceLogosContext";
import { WinkMark } from "./WinkMark";

interface LogoVariant {
  size: number;
  sparkle: boolean;
  opacity: number;
  spin: boolean;
  speedScale: number;
}

const VARIANTS: LogoVariant[] = [
  { size: 48, sparkle: false, opacity: 0.55, spin: false, speedScale: 1 },
  { size: 30, sparkle: true, opacity: 0.4, spin: true, speedScale: 1.3 },
  { size: 64, sparkle: false, opacity: 0.32, spin: false, speedScale: 0.7 },
];

const SIDES = ["left", "right"] as const;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface LogoSpec {
  key: string;
  bounds: BounceBounds;
  variant: LogoVariant;
  seed: number;
}

function buildLogoSpecs(width: number, height: number): LogoSpec[] {
  const specs: LogoSpec[] = [];
  SIDES.forEach((side, sideIndex) => {
    VARIANTS.forEach((variant, variantIndex) => {
      const gapBounds = computeGapBounds(width, height, variant.size);
      if (!gapBounds) return;
      specs.push({
        key: `${side}-${variantIndex}`,
        bounds: side === "left" ? gapBounds.left : gapBounds.right,
        variant,
        seed: sideIndex * VARIANTS.length + variantIndex + 1,
      });
    });
  });
  return specs;
}

export function BouncingLogos() {
  const { enabled } = useBounceLogos();
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const handleResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const specs =
    enabled && !prefersReducedMotion() ? buildLogoSpecs(viewport.width, viewport.height) : [];

  if (specs.length === 0) return null;

  return (
    <>
      {specs.map((spec) => (
        <BouncingLogo key={spec.key} bounds={spec.bounds} seed={spec.seed} variant={spec.variant} />
      ))}
    </>
  );
}

function BouncingLogo({
  bounds,
  seed,
  variant,
}: {
  bounds: BounceBounds;
  seed: number;
  variant: LogoVariant;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [initialState] = useState<BounceState>(() =>
    createInitialState(bounds, seed, variant.speedScale)
  );
  const stateRef = useRef<BounceState>(initialState);
  const boundsRef = useRef(bounds);

  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  useEffect(() => {
    let frameId: number;
    let lastTime: number | null = null;

    const tick = (time: number) => {
      if (lastTime !== null) {
        const dt = Math.min((time - lastTime) / 1000, 0.1);
        stateRef.current = stepBounce(stateRef.current, boundsRef.current, dt);
        ref.current!.style.transform = `translate(${stateRef.current.x}px, ${stateRef.current.y}px)`;
      }
      lastTime = time;
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      data-testid="bouncing-logo"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: variant.size,
        height: variant.size,
        pointerEvents: "none",
        opacity: variant.opacity,
        zIndex: 0,
        willChange: "transform",
        transform: `translate(${initialState.x}px, ${initialState.y}px)`,
      }}
    >
      <div className={variant.spin ? "nf-bounce-spin" : undefined}>
        <WinkMark size={variant.size} sparkle={variant.sparkle} aria-hidden />
      </div>
    </div>
  );
}
