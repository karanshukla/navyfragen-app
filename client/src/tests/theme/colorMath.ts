/**
 * WCAG contrast helpers for `contrast.test.ts`. Lives under `src/tests/` rather
 * than `src/lib/` because nothing ships it — it exists to check the palette, not
 * to render with it.
 */

export type Rgb = [number, number, number];

export function parseColor(value: string): Rgb {
  const v = value.trim();

  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hexMatch) {
    const h = hexMatch[1];
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1].split(",").map((p) => parseFloat(p));
    return [r, g, b];
  }

  throw new Error(`Unsupported colour: ${value}`);
}

/** Alpha of an `rgba()` string; 1 for anything opaque. */
export function alphaOf(value: string): number {
  const m = /^rgba\(([^)]+)\)$/i.exec(value.trim());
  if (!m) return 1;
  const parts = m[1].split(",");
  return parts.length === 4 ? parseFloat(parts[3]) : 1;
}

export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((v, i) => v * alpha + bg[i] * (1 - alpha)) as Rgb;
}

/** Flattens a possibly-translucent colour onto an opaque backdrop. */
export function flatten(value: string, backdrop: Rgb): Rgb {
  return composite(parseColor(value), alphaOf(value), backdrop);
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every colour a `linear-gradient(...)` passes through, sampled densely enough
 * that a mid-ramp dip cannot hide between two stops. Checking only the declared
 * stops is what let the old cyan/emerald presets look compliant.
 */
export function gradientSamples(gradient: string, step = 0.02): Rgb[] {
  const stops = [...gradient.matchAll(/(#[0-9a-f]{3,6})\s+([\d.]+)%/gi)].map((m) => ({
    color: parseColor(m[1]),
    at: parseFloat(m[2]) / 100,
  }));
  if (stops.length < 2) throw new Error(`Not a multi-stop gradient: ${gradient}`);

  const samples: Rgb[] = [];
  for (let t = 0; t <= 1 + 1e-9; t += step) {
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1].at) i++;
    const span = stops[i + 1].at - stops[i].at;
    const f = span === 0 ? 0 : (t - stops[i].at) / span;
    samples.push(
      stops[i].color.map((v, k) => v + (stops[i + 1].color[k] - v) * f) as unknown as Rgb
    );
  }
  return samples;
}

/** The single worst contrast `fg` reaches anywhere along `gradient`. */
export function worstOnGradient(fg: Rgb, gradient: string): number {
  return Math.min(...gradientSamples(gradient).map((bg) => contrast(fg, bg)));
}
