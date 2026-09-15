import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The colour tokens are read out of globals.css and measured, rather than
 * trusted.
 *
 * This file exists because this system has already lost this argument once:
 * `--ink-3` sat at 46% lightness reading 4.63:1 in isolation, and fell to
 * 4.06:1 the moment an ambient field tinted the ground behind it — the comment
 * beside that token still records the correction to 41%. A palette is a set of
 * numbers with a legal requirement attached, and a number nobody measures is a
 * number that drifts.
 *
 * It matters most right now because the brand hue has just moved from indigo to
 * the green taken from the Qantara design. The design's own green, #00ab55
 * (hsl 150 100% 34%), reads 2.94:1 against white — it would have failed every
 * button label in the product. The shipped value is darker for exactly that
 * reason, and this test is what stops someone "correcting" it back to match the
 * mockup.
 */

const css = readFileSync(fileURLToPath(new URL("../globals.css", import.meta.url)), "utf8");

/** The light block is the first definition; the dark block redefines it later. */
function token(name: string, theme: "light" | "dark"): [number, number, number] {
  const matches = [...css.matchAll(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`, "g"))];
  const hit = theme === "light" ? matches[0] : matches[matches.length - 1];
  if (!hit) throw new Error(`token --${name} not found`);
  return [Number(hit[1]), Number(hit[2]), Number(hit[3])];
}

function toRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = L - c / 2;
  return [r + m, g + m, b + m];
}

function luminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string, theme: "light" | "dark") {
  const la = luminance(toRgb(token(a, theme)));
  const lb = luminance(toRgb(token(b, theme)));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG AA: 4.5:1 for body text, 3:1 for large text and UI boundaries. */
const AA_TEXT = 4.5;

describe("colour token contrast", () => {
  describe.each(["light", "dark"] as const)("%s theme", (theme) => {
    it("puts legible labels on the primary fill", () => {
      // Every filled primary button in the product is this pair.
      expect(contrast("primary", "primary-foreground", theme)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("puts legible labels on the accent fill", () => {
      expect(contrast("accent", "accent-foreground", theme)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("keeps primary TEXT readable on the page ground", () => {
      // --primary-ink exists precisely because the fill hue is not a text hue.
      expect(contrast("primary-ink", "surface-0", theme)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("keeps accent TEXT readable on the page ground", () => {
      expect(contrast("accent-ink", "surface-0", theme)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("keeps body and metadata ink readable on the page ground", () => {
      expect(contrast("ink-1", "surface-0", theme)).toBeGreaterThanOrEqual(AA_TEXT);
      // The token whose regression prompted this file.
      expect(contrast("ink-3", "surface-0", theme)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  /**
   * The home hero's brand panel carries WHITE copy in both themes — its headline,
   * eyebrow and description are text-white — so its fill cannot follow --primary,
   * which dark mode lifts to a mint built to sit under dark ink. When the panel's
   * first stop was hsl(var(--primary)), dark theme put the headline on
   * rgb(100,216,158) at 1.78:1, under even the 3:1 large-text floor.
   */
  describe("brand panel", () => {
    const onWhite = (name: string, theme: "light" | "dark") =>
      (1 + 0.05) / (luminance(toRgb(token(name, theme))) + 0.05);

    it.each(["panel-brand-from", "panel-brand-to"])("keeps white copy legible on --%s in both themes", (name) => {
      expect(onWhite(name, "light")).toBeGreaterThanOrEqual(AA_TEXT);
      expect(onWhite(name, "dark")).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("does not flip with the theme, and the utility paints from its own stops", () => {
      // token() reads the LAST definition for dark, so a redefinition in the
      // .dark block is exactly what this catches.
      expect(token("panel-brand-from", "dark")).toEqual(token("panel-brand-from", "light"));
      expect(token("panel-brand-to", "dark")).toEqual(token("panel-brand-to", "light"));
      const panel = css.match(/\.u-panel-brand\s*\{[^}]*\}/)?.[0] ?? "";
      expect(panel).toContain("var(--panel-brand-from)");
      expect(panel).toContain("var(--panel-brand-to)");
      expect(panel).not.toContain("var(--primary");
    });
  });

  /**
   * Brand, trade and register have to stay TELLABLE APART, not merely legible.
   * Moving the brand to green put it 34° from verdigris, which measured as the
   * closest pair in the system — closer than trade is to register, the two it
   * most needs to differ from. Trade moved to compensate. Perceptual distance,
   * not hue arithmetic, is what says whether that worked.
   */
  it("keeps the three semantic hues perceptually distinct", () => {
    const lab = (name: string) => {
      const [r, g, b] = toRgb(token(name, "light")).map((v) =>
        v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
      ) as [number, number, number];
      const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
      const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
      const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
    };
    const dE = (a: string, b: string) =>
      Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]!));

    // 40 is roughly "obviously a different colour at a glance". The pairs sat
    // at 98 / 128 / 66 before the retint and must not collapse below this.
    expect(dE("primary", "accent"), "brand vs trade").toBeGreaterThan(55);
    expect(dE("primary", "brass"), "brand vs register").toBeGreaterThan(55);
    expect(dE("accent", "brass"), "trade vs register").toBeGreaterThan(55);
  });
});
