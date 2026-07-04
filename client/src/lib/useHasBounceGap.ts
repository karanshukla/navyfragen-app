import { useEffect, useState } from "react";

import { computeGapBounds, LOGO_SIZE } from "./bounceLogos";

function hasGapNow(): boolean {
  return computeGapBounds(window.innerWidth, window.innerHeight, LOGO_SIZE) !== null;
}

export function useHasBounceGap(): boolean {
  const [hasGap, setHasGap] = useState(hasGapNow);

  useEffect(() => {
    const handleResize = () => setHasGap(hasGapNow());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return hasGap;
}
