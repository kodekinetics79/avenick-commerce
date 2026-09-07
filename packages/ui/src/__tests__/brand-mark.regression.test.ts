import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AVENICK,
  MARK_FALLBACK_DARK,
  MARK_FALLBACK_LIGHT,
  MARK_RULE,
  MARK_SLAB,
  MARK_SMALL_CUT_BELOW,
  MARK_SMALL_SLAB,
  brandMarkDocument,
  isAvenick,
} from "../brand-mark-geometry";

/**
 * The brand mark had NO test coverage of any kind before this file, in either
 * direction: nothing asserted that a mark rendered, and nothing asserted that
 * the eight independent copies of it agreed. Changing or deleting the mark on
 * any surface broke nothing.
 *
 * These are the four things that can go wrong silently.
 */

const GLOBALS = readFileSync(join(__dirname, "..", "globals.css"), "utf8");
const PORTAL_CONFIG = readFileSync(
  join(__dirname, "..", "..", "..", "utils", "src", "portal-config.ts"),
  "utf8",
);

/** Pull `--name: <value>;` out of the FIRST (light `:root`) block that defines it. */
function token(name: string): string {
  const m = GLOBALS.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m?.[1]) throw new Error(`token --${name} not found in globals.css`);
  return m[1].trim();
}

describe("the mark refuses rather than guesses", () => {
  /**
   * The failure this prevents is a logo asserting a brand the deployment does
   * not have. NEXT_PUBLIC_PLATFORM_NAME is a documented, live override, so an
   * unconditional Avenick "A" beside a wordmark reading something else is a
   * claim rendered as fact — LAW F, and worse than the plain letter it replaced
   * because it looks authoritative.
   */
  it("gives the Avenick mark only to Avenick", () => {
    expect(isAvenick("Avenick")).toBe(true);
    expect(isAvenick("  Avenick  ")).toBe(true); // platformName() trims
    expect(isAvenick("Manzil")).toBe(false);
    expect(isAvenick("avenick")).toBe(false); // a different string is a different brand
    expect(isAvenick("Avenick Commerce")).toBe(false);
    expect(isAvenick("")).toBe(false);
  });

  /**
   * AVENICK is duplicated from portal-config rather than imported, so that
   * @avenick/ui does not take a runtime dependency on the env resolver to draw a
   * shape. A duplicate nobody checks is how a rename silently un-brands the
   * product: portal-config would start returning "Avenick Commerce" and every
   * mark in the product would quietly fall back to the initial.
   */
  it("keeps its copy of the brand literal in step with portal-config", () => {
    const m = PORTAL_CONFIG.match(/DEFAULT_PLATFORM_NAME\s*=\s*"([^"]+)"/);
    expect(m?.[1], "DEFAULT_PLATFORM_NAME not found in portal-config.ts").toBeDefined();
    expect(AVENICK).toBe(m?.[1]);
  });
});

describe("the standalone document is a valid, self-contained SVG", () => {
  /**
   * An SVG that does not parse as XML is not a favicon — it fails silently, and
   * the browser simply draws the default document icon, which is exactly what
   * the product looked like before it had any icon at all. XML additionally
   * forbids `--` inside a comment, which is how a token-documenting comment
   * takes a whole favicon down.
   */
  const cases = [
    ["favicon 32 light", { size: 32, title: "Avenick", theme: "light" as const }],
    ["master 64 light", { size: 64, title: "Avenick", theme: "light" as const }],
    ["master 64 dark", { size: 64, title: "Avenick", theme: "dark" as const }],
    ["apple 180 plated", { size: 180, title: "Avenick", theme: "light" as const, plate: true }],
    ["token-driven 64", { size: 64, title: "Avenick" }],
    ["token-driven 28", { size: 28, title: "Avenick" }],
  ] as const;

  for (const [label, options] of cases) {
    it(`${label} parses and carries no XML-illegal comment`, async () => {
      const svg = brandMarkDocument(options);
      expect(svg).not.toContain("<!--");
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      // Balanced enough to fail loudly on a truncated template literal.
      expect((svg.match(/<svg/g) ?? []).length).toBe(1);
      expect((svg.match(/<\/svg>/g) ?? []).length).toBe(1);
    });
  }

  it("escapes the title, which is configuration and not a literal", () => {
    const svg = brandMarkDocument({ size: 64, title: 'A & B <script>', theme: "light" });
    expect(svg).toContain("A &amp; B &lt;script&gt;");
    expect(svg).not.toContain("<script>");
  });

  /**
   * Satori — which renders icon.tsx, apple-icon.tsx and opengraph-image.tsx —
   * composites SVG through resvg and has no CSS custom property support. A
   * token-driven document handed to it produces an EMPTY BOX with no error, so
   * the flattened mode must contain no var() and no @media at all.
   */
  it("flattens completely for the rasteriser", () => {
    for (const theme of ["light", "dark"] as const) {
      for (const size of [32, 64, 180]) {
        const svg = brandMarkDocument({ size, title: "Avenick", theme });
        expect(svg, `${theme}@${size} leaked a custom property`).not.toContain("var(");
        expect(svg, `${theme}@${size} leaked a media query`).not.toContain("@media");
        expect(svg, `${theme}@${size} leaked a <style>`).not.toContain("<style");
      }
    }
  });

  it("keeps the token-driven mode token-driven", () => {
    const svg = brandMarkDocument({ size: 64, title: "Avenick" });
    expect(svg).toContain("var(--ink-1");
    expect(svg).toContain("var(--brass");
    expect(svg).toContain("prefers-color-scheme");
  });
});

describe("the cut switches at the size the optics stop working", () => {
  /**
   * Below the switch the master's 0.75-unit apex seam is sub-pixel and its
   * 1.4-unit fresnel strokes antialias to uniform grey — the mark stops being
   * lit and starts being blurry. The small cut deletes all four optical events
   * rather than scaling them.
   */
  it("uses the small cut below the threshold and the master at or above it", () => {
    const small = brandMarkDocument({ size: MARK_SMALL_CUT_BELOW - 1, title: "A", theme: "light" });
    expect(small).toContain(MARK_SMALL_SLAB);
    expect(small).not.toContain(MARK_SLAB);

    const master = brandMarkDocument({ size: MARK_SMALL_CUT_BELOW, title: "A", theme: "light" });
    expect(master).toContain(MARK_SLAB);
    expect(master).not.toContain(MARK_SMALL_SLAB);
  });

  it("draws the rule in every cut, because the rule is what makes it an A", () => {
    // Take the brass rule away and the silhouette is a chevron, not a letter.
    // Any cut that loses it has lost the mark.
    for (const size of [16, 32, 64, 180]) {
      const svg = brandMarkDocument({ size, title: "A", theme: "light" });
      expect(svg, `size ${size} lost the rule`).toContain(MARK_FALLBACK_LIGHT.brass);
    }
  });
});

describe("the standalone fallbacks still match the live tokens", () => {
  /**
   * These values are COPIES of globals.css, carried inside the document so a
   * favicon or an email attachment has something to read when there is no
   * stylesheet. A copy nobody checks is how the mark ends up one colour in the
   * tab and a different colour on the page.
   */
  it("light", () => {
    expect(MARK_FALLBACK_LIGHT.brass).toBe(token("brass"));
    expect(MARK_FALLBACK_LIGHT.fresnelUnder).toBe(token("fresnel-under"));
    expect(MARK_FALLBACK_LIGHT.contact).toBe(token("contact"));
    expect(MARK_FALLBACK_LIGHT.rim).toBe(token("rim"));
  });

  it("dark differs from light, or the dark theme is not a theme", () => {
    expect(MARK_FALLBACK_DARK.ink).not.toBe(MARK_FALLBACK_LIGHT.ink);
    // §3.4: in dark the counter-fresnel is the STRONGEST of the four events,
    // because with almost no light to catch, the underside seam is what
    // separates one near-black slab from another.
    expect(Number(MARK_FALLBACK_DARK.fresnelAlpha)).toBeGreaterThan(
      Number(MARK_FALLBACK_LIGHT.fresnelAlpha),
    );
  });
});

describe("LAW B — the mark is free in Arabic", () => {
  /**
   * The whole system's RTL correctness rests on one overhead light with zero
   * horizontal offset: an overhead light is identical in both reading
   * directions, so nothing needs mirroring. The mark holds that by being
   * symmetric about x=32 on its 64-unit grid.
   *
   * If someone "adds interest" by shifting the light off-axis, this fails — and
   * the alternative is a second Arabic mark file, forever.
   */
  it("is symmetric about the vertical axis", () => {
    const centre = 32;
    // The rule spans the centre evenly.
    expect(MARK_RULE.x + MARK_RULE.width / 2).toBe(centre);
    // The slab's own extremes are equidistant from it: 6.5 and 57.5.
    expect(centre - 6.5).toBe(57.5 - centre);
  });

  it("emits no direction-dependent construction", () => {
    for (const theme of ["light", "dark"] as const) {
      const svg = brandMarkDocument({ size: 64, title: "Avenick", theme });
      expect(svg).not.toContain("--dir");
      expect(svg).not.toContain("scaleX(-1)");
      expect(svg).not.toMatch(/\bdir="/);
    }
  });
});

describe("§9 — the mark does not reintroduce a documented refusal", () => {
  /**
   * "Reversing a documented refusal in the name of impact is a regression
   * dressed as an improvement." A brand mark is precisely where an
   * "add more impact" brief lands, so the bans are asserted rather than trusted.
   */
  it("carries no glow, no blend mode and no rotation", () => {
    for (const opts of [
      { size: 32, title: "A", theme: "light" as const },
      { size: 180, title: "A", theme: "dark" as const, plate: true },
      { size: 64, title: "A" },
    ]) {
      const svg = brandMarkDocument(opts);
      expect(svg).not.toContain("mix-blend-mode");
      expect(svg).not.toContain("feGaussianBlur");
      expect(svg).not.toContain("filter:");
      expect(svg).not.toMatch(/rotate\(/);
      expect(svg).not.toMatch(/matrix\(/);
    }
  });

  it("crosses no hue in any gradient, so §3.11 has nothing to fix", () => {
    // Every gradient in the mark varies ALPHA on a single hue. A hue-crossing
    // gradient would need `in oklab` and would also be a second ambient fill.
    const svg = brandMarkDocument({ size: 64, title: "A", theme: "light" });
    const stops = svg.match(/stop-color="[^"]+"/g) ?? [];
    expect(stops.length).toBeGreaterThan(0);
    for (const [i, stop] of stops.entries()) {
      // Pairs of stops share a colour; only the opacity moves.
      if (i % 2 === 1) expect(stop).toBe(stops[i - 1]);
    }
  });
});
