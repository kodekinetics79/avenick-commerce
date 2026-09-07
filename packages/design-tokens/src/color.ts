/**
 * HSL → RGB, and the ARGB literal Dart wants.
 *
 * Every colour token in `packages/ui/src/globals.css` is a BARE HSL TRIPLE
 * (`36 20% 97.5%`) rather than a `hsl()` function, because the whole system is
 * built on composing alpha at the call site: `hsl(var(--ink-1) / .06)`. That is
 * the one thing a naive "read the computed style" extractor cannot do, and it is
 * why this package parses the source rather than a rendered page.
 *
 * The conversion below is the CSS Color 4 algorithm verbatim. It is written out
 * rather than pulled from a colour library on purpose: a library that rounds
 * through 8-bit sRGB on the way in and out will land a half-step off on the
 * low-lightness dark surfaces, where the whole dark ladder is 13 L-points wide
 * and half a step is visible.
 */

export interface RgbaColor {
  /** 0–255, rounded. */
  readonly r: number;
  /** 0–255, rounded. */
  readonly g: number;
  /** 0–255, rounded. */
  readonly b: number;
  /** 0–1. */
  readonly a: number;
}

/**
 * `h` in degrees (any real number — wrapped), `s` and `l` as percentages 0–100,
 * `a` as a 0–1 fraction.
 */
export function hslToRgba(h: number, s: number, l: number, a = 1): RgbaColor {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s / 100);
  const lig = clamp01(l / 100);

  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = lig - c / 2;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hp < 1) [rp, gp, bp] = [c, x, 0];
  else if (hp < 2) [rp, gp, bp] = [x, c, 0];
  else if (hp < 3) [rp, gp, bp] = [0, c, x];
  else if (hp < 4) [rp, gp, bp] = [0, x, c];
  else if (hp < 5) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
    a: clamp01(a),
  };
}

/** `Color(0xAARRGGBB)` is what Dart wants; this returns the `0xAARRGGBB` half. */
export function toArgbHex(colour: RgbaColor): string {
  const alpha = Math.round(clamp01(colour.a) * 255);
  const parts = [alpha, colour.r, colour.g, colour.b].map((n) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).toUpperCase().padStart(2, "0"),
  );
  return `0x${parts.join("")}`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
