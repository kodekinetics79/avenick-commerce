import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { emitDart } from "../dart";
import { extractTokens } from "../extract";
import { toDartField } from "../extract";
import { readGlobalsCss } from "./helpers";

const SOURCE = "packages/ui/src/globals.css";
const css = readGlobalsCss();
const extraction = extractTokens(css, SOURCE);
const dart = emitDart(extraction, "@avenick/design-tokens").code;

/** The one line in the file that declares `name: value,` for a given field. */
function lineFor(field: string, after: string): string {
  const start = dart.indexOf(after);
  expect(start, `anchor \`${after}\` not found`).toBeGreaterThan(-1);
  const match = new RegExp(`^\\s*${field}: .*$`, "m").exec(dart.slice(start));
  expect(match, `no \`${field}:\` line after \`${after}\``).not.toBeNull();
  return (match as RegExpExecArray)[0].trim();
}

describe("the generated Dart", () => {
  it("is marked generated and pins the stylesheet it came from", () => {
    expect(dart.startsWith("// GENERATED — DO NOT EDIT.")).toBe(true);
    const sha = createHash("sha256").update(css, "utf8").digest("hex");
    expect(dart).toContain(`const String meridianTokensSourceSha256 =\n    '${sha}';`);
  });

  it("declares a ThemeExtension with a light and a dark instance", () => {
    expect(dart).toContain("class MeridianTokens extends ThemeExtension<MeridianTokens> {");
    expect(dart).toContain("static const MeridianTokens light = MeridianTokens(");
    expect(dart).toContain("static const MeridianTokens dark = MeridianTokens(");
    expect(dart).toContain("MeridianTokens copyWith({");
    expect(dart).toContain("MeridianTokens lerp(covariant ThemeExtension<MeridianTokens>? other, double t) {");
    expect(dart).toContain("if (other is! MeridianTokens) return this;");
  });

  it("gives every token a field in both themes", () => {
    const fields = Object.keys(extraction.light).length;
    expect(fields).toBeGreaterThan(200);
    // Scoped to the MeridianTokens class: the fluid-size helper above it has
    // `required this.` parameters of its own.
    const body = dart.slice(dart.indexOf("class MeridianTokens extends"));
    expect(body.match(/^ {4}required this\.\w+,$/gm)).toHaveLength(fields);
    // copyWith and lerp each carry one line per field, plus the light and dark
    // instances — four generated lines per token, none hand-maintained.
    expect(body.match(/^ {6}\w+: \w+ \?\? this\.\w+,$/gm)).toHaveLength(fields);
  });
});

/**
 * A snapshot of the lines that would be silently wrong if the pipeline broke:
 * one colour, one alpha-composed shadow stack, one fluid step, one easing curve,
 * one duration that came out of a calc(), and one string that has to survive
 * quoting. Written out rather than left to an auto-snapshot file so a diff shows
 * the VALUE that changed, in a review, not just that a blob moved.
 */
describe("generated Dart literals", () => {
  it("light", () => {
    const anchor = "static const MeridianTokens light = MeridianTokens(";
    expect(lineFor("surface0", anchor)).toBe("surface0: Color(0xFFFAF9F7),");
    expect(lineFor("primary", anchor)).toBe("primary: Color(0xFF057F42),");
    expect(lineFor("ink1", anchor)).toBe("ink1: Color(0xFF161922),");
    expect(lineFor("elev0", anchor)).toBe("elev0: <BoxShadow>[],");
    expect(lineFor("elev2", anchor)).toBe(
      "elev2: <BoxShadow>[" +
        "BoxShadow(color: Color(0x0B151928), offset: Offset(0.0, 1.0), blurRadius: 1.0, spreadRadius: 0.0), " +
        "BoxShadow(color: Color(0x0E151928), offset: Offset(0.0, 2.0), blurRadius: 5.0, spreadRadius: -2.0)],",
    );
    expect(lineFor("fsHero", anchor)).toBe(
      "fsHero: MeridianFluidSize(minPx: 40.0, maxPx: 92.0, basePx: 0.0, remCoefficient: 1.293, vwCoefficient: 4.95),",
    );
    expect(lineFor("easeStandard", anchor)).toBe("easeStandard: Cubic(0.32, 0.72, 0.0, 1.0),");
    expect(lineFor("tPanel", anchor)).toBe("tPanel: Duration(microseconds: 220000),");
    expect(lineFor("fontProvenance", anchor)).toBe('fontProvenance: "Source Serif 4",');
    expect(lineFor("imgRatioCard", anchor)).toBe("imgRatioCard: 0.8,");
    expect(lineFor("stateHover", anchor)).toBe("stateHover: 0.08,");
    expect(lineFor("originInlineStart", anchor)).toBe('originInlineStart: "left",');
  });

  it("dark", () => {
    const anchor = "static const MeridianTokens dark = MeridianTokens(";
    expect(lineFor("surface0", anchor)).toBe("surface0: Color(0xFF08090C),");
    expect(lineFor("primary", anchor)).toBe("primary: Color(0xFF64D89E),");
    expect(lineFor("ink1", anchor)).toBe("ink1: Color(0xFFF2F0EE),");
    // The alias layer has to re-resolve in the dark cascade rather than carry
    // the light theme's value across.
    expect(lineFor("background", anchor)).toBe("background: Color(0xFF08090C),");
    expect(lineFor("mutedForeground", anchor)).toBe("mutedForeground: Color(0xFF9DA1AF),");
  });

  it("picks a lerp per Dart type rather than one for everything", () => {
    expect(dart).toContain("surface0: Color.lerp(surface0, other.surface0, t)!,");
    expect(dart).toContain("radius: _lerpDouble(radius, other.radius, t),");
    expect(dart).toContain("tPanel: _lerpDuration(tPanel, other.tPanel, t),");
    expect(dart).toContain("elev2: BoxShadow.lerpList(elev2, other.elev2, t)!,");
    expect(dart).toContain("fsHero: MeridianFluidSize.lerp(fsHero, other.fsHero, t),");
    // Half of Inter and half of a cubic-bezier is neither. Snap at the crossover.
    expect(dart).toContain("fontSans: t < 0.5 ? fontSans : other.fontSans,");
    expect(dart).toContain("easeOut: t < 0.5 ? easeOut : other.easeOut,");
  });

  it("emits doubles that Dart will not infer as int", () => {
    // `Cubic(0, 1, 0.36, 1)` is a compile error against `const Cubic(double…)`.
    const intLiterals = dart.match(/(?:blurRadius|spreadRadius|minPx|maxPx): -?\d+(?![.\d])/g);
    expect(intLiterals).toBeNull();
  });
});

describe("Dart field naming", () => {
  it("lowerCamelCases a custom property", () => {
    expect(toDartField("--surface-0")).toBe("surface0");
    expect(toDartField("--fs-h1")).toBe("fsH1");
    expect(toDartField("--ease-in-out")).toBe("easeInOut");
    expect(toDartField("--img-ratio-card")).toBe("imgRatioCard");
    expect(toDartField("--dir")).toBe("dir");
  });

  it("escapes a Dart reserved word rather than emitting an uncompilable field", () => {
    expect(toDartField("--switch")).toBe("switch$");
    expect(toDartField("--class")).toBe("class$");
  });

  it("refuses a token that would collide with a member MeridianTokens already has", () => {
    // `--light` would become a field called `light`, which is the name of the
    // static const light theme. Fail here, with the CSS property named, rather
    // than in a Dart compiler error inside a generated file.
    expect(() => emitDart(extractTokens(":root { --light: 0 0% 100%; }", SOURCE), "test")).toThrowError(
      /MeridianTokens already/,
    );
  });

  it("refuses two properties that would collapse onto one field", () => {
    expect(() => extractTokens(":root { --img-plate: 0 0% 100%; --imgPlate: 0 0% 0%; }", SOURCE)).toThrowError(
      /both map to the Dart field/,
    );
  });
});
