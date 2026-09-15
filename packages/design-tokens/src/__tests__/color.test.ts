import { describe, expect, it } from "vitest";

import { hslToRgba, toArgbHex } from "../color";
import { extractTokens } from "../extract";
import { readGlobalsCss } from "./helpers";

/**
 * The HSL→RGB conversion is checked against REAL token values from
 * packages/ui/src/globals.css rather than round numbers, because the values that
 * would expose a bug are the awkward ones: 97.5% lightness on the page ground,
 * 4% on the dark ground, and 92% saturation on the brand green — the two ends of
 * the ramp and the most saturated hue in the system.
 *
 * The expectations were computed with an independent implementation (the
 * hue2rgb form rather than the chroma form), so a shared algebra mistake in
 * color.ts cannot make this test agree with itself.
 */
describe("hslToRgba", () => {
  const cases: { token: string; hsl: [number, number, number]; rgb: [number, number, number]; argb: string }[] = [
    { token: "--surface-0 (light page ground)", hsl: [36, 20, 97.5], rgb: [250, 249, 247], argb: "0xFFFAF9F7" },
    { token: "--surface-2 (the card)", hsl: [0, 0, 100], rgb: [255, 255, 255], argb: "0xFFFFFFFF" },
    { token: "--ink-1 (light body ink)", hsl: [224, 22, 11], rgb: [22, 25, 34], argb: "0xFF161922" },
    { token: "--primary (brand green)", hsl: [150, 92, 26], rgb: [5, 127, 66], argb: "0xFF057F42" },
    { token: "--accent (deep verdigris)", hsl: [200, 62, 30], rgb: [29, 92, 124], argb: "0xFF1D5C7C" },
    { token: "--brass (the register)", hsl: [36, 56, 42], rgb: [167, 119, 47], argb: "0xFFA7772F" },
    { token: "--danger (light)", hsl: [2, 62, 42], rgb: [174, 45, 41], argb: "0xFFAE2D29" },
    { token: "--surface-0 (dark ground)", hsl: [232, 18, 4], rgb: [8, 9, 12], argb: "0xFF08090C" },
    { token: "--ink-1 (dark, warm off-white)", hsl: [40, 14, 94], rgb: [242, 240, 238], argb: "0xFFF2F0EE" },
    { token: "--primary (dark)", hsl: [150, 60, 62], rgb: [100, 216, 158], argb: "0xFF64D89E" },
  ];

  it.each(cases)("$token", ({ hsl, rgb, argb }) => {
    const [h, s, l] = hsl;
    const converted = hslToRgba(h, s, l);
    expect([converted.r, converted.g, converted.b]).toEqual(rgb);
    expect(toArgbHex(converted)).toBe(argb);
  });

  it("carries alpha into the top byte, which is how the shadow stacks survive", () => {
    // --elev-2's contact layer: `0 1px 1px hsl(var(--shadow) / .045)`.
    expect(toArgbHex(hslToRgba(226, 32, 12, 0.045))).toBe("0x0B151928");
    expect(toArgbHex(hslToRgba(0, 0, 100, 0.72))).toBe("0xB8FFFFFF");
  });

  it("is achromatic when saturation is zero, at every lightness", () => {
    for (const l of [0, 4, 11, 50, 97.5, 100]) {
      const { r, g, b } = hslToRgba(0, 0, l);
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it("wraps hue rather than clipping it", () => {
    expect(hslToRgba(150, 92, 26)).toEqual(hslToRgba(510, 92, 26));
    expect(hslToRgba(150, 92, 26)).toEqual(hslToRgba(-210, 92, 26));
  });
});

describe("the real stylesheet", () => {
  const extraction = extractTokens(readGlobalsCss(), "packages/ui/src/globals.css");

  it("converts the tokens it actually read to the same colours", () => {
    const expectations: Record<string, string> = {
      "--surface-0": "0xFFFAF9F7",
      "--surface-2": "0xFFFFFFFF",
      "--ink-1": "0xFF161922",
      "--primary": "0xFF057F42",
      "--accent": "0xFF1D5C7C",
    };
    for (const [property, argb] of Object.entries(expectations)) {
      const token = extraction.light[property];
      expect(token, `${property} is missing from the light set`).toBeDefined();
      expect(token?.value.kind).toBe("color");
      if (token?.value.kind === "color") expect(token.value.argb).toBe(argb);
    }
  });

  it("resolves a var() alias against the scope it is USED in, not the one it is declared in", () => {
    // --neutral-ink: var(--ink-2) is declared once, in :root. It has to come out
    // as the light ink-2 in light and the DARK ink-2 in dark, or the dark theme
    // ships the light theme's secondary text colour and looks plausible.
    const light = extraction.light["--neutral-ink"];
    const dark = extraction.dark["--neutral-ink"];
    expect(light?.value.kind === "color" && light.value.argb).toBe("0xFF4A505E");
    expect(dark?.value.kind === "color" && dark.value.argb).toBe("0xFFB0B3BF");

    // Same mechanism, through the legacy shadcn alias layer.
    const lightBackground = extraction.light["--background"];
    const darkBackground = extraction.dark["--background"];
    expect(lightBackground?.value.kind === "color" && lightBackground.value.argb).toBe("0xFFFAF9F7");
    expect(darkBackground?.value.kind === "color" && darkBackground.value.argb).toBe("0xFF08090C");
  });
});
