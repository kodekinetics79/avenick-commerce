import { describe, expect, it } from "vitest";

import { extractTokens } from "../extract";
import { UnsupportedValueError } from "../scopes";
import { coerceValue, splitTopLevel } from "../values";
import { readGlobalsCss } from "./helpers";

const SOURCE = "packages/ui/src/globals.css";
const site = (property: string, line = 1) => ({ property, scope: "light", sourceFile: SOURCE, line });

describe("inset shadow layers are dropped, and the drop is reported", () => {
  const extraction = extractTokens(readGlobalsCss(), SOURCE);
  const dropped = extraction.warnings.filter((w) => w.kind === "inset-shadow-dropped");

  it("drops every inset layer in the real elevation ladder", () => {
    // Flutter's BoxShadow paints outside the box only. Meridian's light model
    // has four parts and three of them are inside it, so this is the single
    // largest web/mobile delta in the system and it has to be countable.
    expect(dropped.length).toBe(18);
    expect(new Set(dropped.map((w) => w.property))).toEqual(
      new Set(["--elev-1", "--elev-2", "--elev-3", "--elev-4", "--elev-5"]),
    );
    expect(new Set(dropped.map((w) => w.scope))).toEqual(new Set(["light", "dark"]));
  });

  it("names the layer it dropped, not just the token", () => {
    const rimSeam = dropped.find((w) => w.detail.includes("inset 0 1px 0 hsl(0 0% 100% / .72)"));
    expect(rimSeam?.property).toBe("--elev-2");
    expect(rimSeam?.scope).toBe("light");
    expect(rimSeam?.line).toBeGreaterThan(0);
  });

  it("leaves --elev-1 empty in light, because BOTH of its layers are inset", () => {
    // This one is worth pinning: the recessed rung is entirely inset, so on
    // mobile it has no shadow at all. If somebody later sees an empty list here
    // and 'fixes' it by inventing a drop shadow, they have inverted the rung.
    expect(extraction.light["--elev-1"]?.value).toEqual({ kind: "shadows", layers: [] });
    expect(extraction.light["--elev-0"]?.value).toEqual({ kind: "shadows", layers: [] });
  });

  it("keeps the non-inset layers with their alpha composed in", () => {
    const elev2 = extraction.light["--elev-2"]?.value;
    expect(elev2?.kind).toBe("shadows");
    if (elev2?.kind !== "shadows") return;
    expect(elev2.layers).toHaveLength(2);
    expect(elev2.layers[0]).toMatchObject({
      offsetX: 0,
      offsetY: 1,
      blurRadius: 1,
      spreadRadius: 0,
      argb: "0x0B151928",
    });
    expect(elev2.layers[1]).toMatchObject({ offsetY: 2, blurRadius: 5, spreadRadius: -2 });
  });

  it("warns per layer even for a synthetic stack, so the count is not a fixture artefact", () => {
    const result = coerceValue(
      "inset 0 1px 0 hsl(0 0% 100% / .72), 0 2px 4px hsl(226 32% 12% / .06), inset 0 -1px 0 hsl(0 0% 0% / .34)",
      site("--elev-9", 42),
    );
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.every((w) => w.kind === "inset-shadow-dropped")).toBe(true);
    expect(result.warnings[0]?.line).toBe(42);
    expect(result.value).toMatchObject({ kind: "shadows" });
    if (result.value.kind === "shadows") expect(result.value.layers).toHaveLength(1);
  });
});

describe("typed coercion", () => {
  it("reads a bare HSL triple as a colour", () => {
    expect(coerceValue("36 20% 97.5%", site("--surface-0")).value).toMatchObject({
      kind: "color",
      hsl: [36, 20, 97.5],
      argb: "0xFFFAF9F7",
    });
  });

  it("separates lengths, unitless numbers, percentages and ratios", () => {
    expect(coerceValue("14px", site("--radius")).value).toEqual({ kind: "double", value: 14, unit: "px" });
    expect(coerceValue("0.5px", site("--press-y")).value).toEqual({ kind: "double", value: 0.5, unit: "px" });
    expect(coerceValue("-2px", site("--lift-y")).value).toEqual({ kind: "double", value: -2, unit: "px" });
    expect(coerceValue("680", site("--fw-hero")).value).toEqual({ kind: "double", value: 680, unit: "none" });
    expect(coerceValue("-.034em", site("--tr-hero")).value).toEqual({ kind: "double", value: -0.034, unit: "em" });
    expect(coerceValue("68ch", site("--measure-prose")).value).toEqual({ kind: "double", value: 68, unit: "ch" });
    // A CSS percentage becomes a 0–1 fraction, because that is what every
    // Flutter API that takes one wants.
    expect(coerceValue("8%", site("--state-hover")).value).toEqual({ kind: "double", value: 0.08, unit: "percent" });
    expect(coerceValue("4 / 5", site("--img-ratio-card")).value).toEqual({ kind: "double", value: 0.8, unit: "ratio" });
  });

  it("reads durations in both units", () => {
    expect(coerceValue("220ms", site("--dur-3")).value).toEqual({ kind: "duration", milliseconds: 220 });
    expect(coerceValue("0.7s", site("--dur-x")).value).toEqual({ kind: "duration", milliseconds: 700 });
  });

  it("reads a cubic-bezier as four control values", () => {
    expect(coerceValue("cubic-bezier(.32, .72, 0, 1)", site("--ease-standard")).value).toEqual({
      kind: "cubic",
      points: [0.32, 0.72, 0, 1],
    });
  });

  it("keeps both ends and the slope of a fluid clamp", () => {
    expect(coerceValue("clamp(40px, 1.293rem + 4.95vw, 92px)", site("--fs-hero")).value).toEqual({
      kind: "fluid",
      minPx: 40,
      maxPx: 92,
      basePx: 0,
      remCoefficient: 1.293,
      vwCoefficient: 4.95,
    });
  });

  it("distributes linear()'s implicit stops the way CSS does", () => {
    // Four entries with no stop between 0% and 8% land at 2/4/6%, not at
    // 25/50/75% of the whole timeline. Getting this wrong moves the spring's
    // overshoot peak, which is the only thing the curve exists for.
    const value = coerceValue("linear(0, .0021, .0083, .0187, .0332 8%, 1)", site("--ease-spring")).value;
    expect(value.kind).toBe("curveSamples");
    if (value.kind !== "curveSamples") return;
    expect(value.samples.map((s) => s.t)).toEqual([0, 0.02, 0.04, 0.06, 0.08, 1]);
    expect(value.samples.map((s) => s.value)).toEqual([0, 0.0021, 0.0083, 0.0187, 0.0332, 1]);
  });

  it("keeps a data URI whole, commas, parens, quotes and all", () => {
    const noise = extractTokens(readGlobalsCss(), SOURCE).light["--noise"]?.value;
    expect(noise?.kind).toBe("string");
    if (noise?.kind !== "string") return;
    expect(noise.role).toBe("uri");
    expect(noise.value).toContain("feTurbulence");
    expect(noise.value).toContain("stitchTiles='stitch'");
    expect(noise.value.endsWith("%3C/svg%3E")).toBe(true);
  });

  it("splits a comma list at the top level only", () => {
    expect(splitTopLevel("0 1px 1px hsl(226 32% 12% / .045), 0 2px 5px -2px hsl(226 32% 12% / .055)", ",")).toEqual([
      "0 1px 1px hsl(226 32% 12% / .045)",
      "0 2px 5px -2px hsl(226 32% 12% / .055)",
    ]);
    expect(splitTopLevel("url(\"data:image/svg+xml,%3Csvg a='1,2'%3E\")", ",")).toHaveLength(1);
  });
});

describe("what the generator refuses to guess at", () => {
  it("fails on an unrecognised value, citing the line", () => {
    let thrown: unknown;
    try {
      coerceValue("color-mix(in oklab, red, blue)", site("--experiment", 1234));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UnsupportedValueError);
    expect((thrown as Error).message).toContain(`${SOURCE}:1234`);
    expect((thrown as Error).message).toContain("--experiment");
  });

  it("fails on a bare viewport unit rather than pretending a phone is 1440px wide", () => {
    expect(() => coerceValue("4vw", site("--fs-x", 7))).toThrowError(/clamp\(\)/);
  });

  it("fails on an undeclared var() with no fallback", () => {
    expect(() => extractTokens(":root { --a: var(--never-declared); }", SOURCE)).toThrowError(
      /--never-declared is referenced but never declared/,
    );
  });

  it("fails on a circular var() rather than recursing forever", () => {
    expect(() => extractTokens(":root { --a: var(--b); --b: var(--a); }", SOURCE)).toThrowError(/Circular var\(\)/);
  });

  it("fails when a shadow colour is not an hsl() triple", () => {
    expect(() => coerceValue("0 1px 2px #00000022", site("--elev-9", 3))).toThrowError(/hsl\(H S% L% \/ A\)/);
  });
});
