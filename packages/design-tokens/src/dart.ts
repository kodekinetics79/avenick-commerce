/**
 * The Dart emitter.
 *
 * Everything here is written to be READ by a Flutter engineer who has never
 * seen this package, because the file it produces is the only artefact most of
 * them will ever look at. Hence: real types rather than a `Map<String, dynamic>`
 * bag, a `ThemeExtension` so `Theme.of(context).extension<MeridianTokens>()`
 * works the way every other Flutter theme does, and a `lerp` that is generated
 * per-field rather than hand-maintained.
 */

import type { ExtractedToken, TokenExtraction, TokenSet } from "./extract";
import type { TokenValue } from "./values";

export interface DartEmission {
  readonly code: string;
  readonly fieldCount: number;
}

export function emitDart(extraction: TokenExtraction, packageName: string): DartEmission {
  const fields = orderedFields(extraction.light, extraction.dark);

  const lines: string[] = [];
  lines.push(header(extraction, packageName, fields.length));
  lines.push("");
  lines.push("import 'package:flutter/material.dart';");
  lines.push("");
  lines.push(`/// sha256 of ${extraction.source.file} at generation time.`);
  lines.push("///");
  lines.push("/// A build step compares this against the live stylesheet: if they differ, this");
  lines.push("/// file is stale and the Flutter app is rendering last week's design system.");
  lines.push(`const String meridianTokensSourceSha256 =`);
  lines.push(`    '${extraction.source.sha256}';`);
  lines.push("");
  lines.push(FLUID_SIZE_CLASS);
  lines.push("");
  lines.push(SAMPLED_CURVE_CLASS);
  lines.push("");
  lines.push(...tokensClass(extraction, fields));
  lines.push("");
  lines.push(LERP_HELPERS);
  lines.push("");

  return { code: `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`, fieldCount: fields.length };
}

/* ── file scaffolding ───────────────────────────────────────────────────── */

function header(extraction: TokenExtraction, packageName: string, fieldCount: number): string {
  const dropped = extraction.warnings.filter((w) => w.kind === "inset-shadow-dropped").length;
  return [
    "// GENERATED — DO NOT EDIT.",
    "//",
    `// Produced by ${packageName} from ${extraction.source.file}, which is the single`,
    "// source of truth for the Meridian/SIJILL design system across web and mobile.",
    "// Edit the stylesheet and re-run `pnpm --filter " + packageName + " tokens:generate`.",
    "//",
    `//   ${fieldCount} tokens · light + dark`,
    `//   ${dropped} inset shadow layer(s) dropped — Flutter's BoxShadow cannot paint inside`,
    "//   the box, so three of Meridian's four optical events (the highlight seam, the",
    "//   counter-fresnel underside, and the whole of --elev-1 in light) do not survive.",
    "//   `tokens:generate` prints the dropped layers in full on every run — read that",
    "//   list rather than assuming parity with the web.",
    "//",
    "// Colours are stored at full alpha so the system's alpha composition survives:",
    "// CSS `hsl(var(--ink-1) / .06)` is `MeridianTokens.light.ink1.withValues(alpha: 0.06)`.",
    "//",
    "// ignore_for_file: lines_longer_than_80_chars",
  ].join("\n");
}

const FLUID_SIZE_CLASS = `/// A CSS \`clamp(min, base + rem + vw, max)\` type step, kept whole.
///
/// The fluid ramp in globals.css was computed for a 390 → 1440px viewport range.
/// Collapsing each clamp to its minimum would be right on a phone and wrong on
/// every tablet and unfolded foldable, and \`--fs-hero\` spans 40px → 92px, so the
/// slope is the difference between a hero and a heading. Both ends survive here
/// and \`resolve\` does the same arithmetic the browser does.
@immutable
class MeridianFluidSize {
  const MeridianFluidSize({
    required this.minPx,
    required this.maxPx,
    required this.basePx,
    required this.remCoefficient,
    required this.vwCoefficient,
  });

  /// A fixed size expressed as a degenerate fluid one.
  const MeridianFluidSize.fixed(double px)
      : minPx = px,
        maxPx = px,
        basePx = px,
        remCoefficient = 0.0,
        vwCoefficient = 0.0;

  final double minPx;
  final double maxPx;
  final double basePx;
  final double remCoefficient;
  final double vwCoefficient;

  /// [rootFontSizePx] is CSS's \`1rem\` — 16 on a browser default, which is the
  /// number every clamp in globals.css was solved against. Pass the device's
  /// own text-scale-adjusted value only if you have deliberately decided the
  /// mobile ramp should diverge from the web's.
  double resolve(double viewportWidthPx, {double rootFontSizePx = 16.0}) {
    final double preferred =
        basePx + remCoefficient * rootFontSizePx + vwCoefficient * viewportWidthPx / 100.0;
    if (preferred < minPx) return minPx;
    if (preferred > maxPx) return maxPx;
    return preferred;
  }

  static MeridianFluidSize lerp(MeridianFluidSize a, MeridianFluidSize b, double t) {
    return MeridianFluidSize(
      minPx: a.minPx + (b.minPx - a.minPx) * t,
      maxPx: a.maxPx + (b.maxPx - a.maxPx) * t,
      basePx: a.basePx + (b.basePx - a.basePx) * t,
      remCoefficient: a.remCoefficient + (b.remCoefficient - a.remCoefficient) * t,
      vwCoefficient: a.vwCoefficient + (b.vwCoefficient - a.vwCoefficient) * t,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MeridianFluidSize &&
        other.minPx == minPx &&
        other.maxPx == maxPx &&
        other.basePx == basePx &&
        other.remCoefficient == remCoefficient &&
        other.vwCoefficient == vwCoefficient;
  }

  @override
  int get hashCode => Object.hash(minPx, maxPx, basePx, remCoefficient, vwCoefficient);

  @override
  String toString() =>
      'MeridianFluidSize(clamp(\${minPx}px, \${basePx}px + \${remCoefficient}rem + \${vwCoefficient}vw, \${maxPx}px))';
}`;

const SAMPLED_CURVE_CLASS = `/// CSS \`linear()\` — a curve given as sample points rather than a closed form.
///
/// Flutter has no equivalent, and the one token that uses it (\`--ease-spring\`)
/// is a real overshoot sampled at 44 points from bounce ≈ .15. Approximating it
/// with \`Curves.elasticOut\` would be a different curve wearing its name, so the
/// samples are carried across and interpolated exactly as CSS does.
/// There is deliberately no \`assert\` on the constructor. Dart cannot evaluate
/// \`List.length\` inside a const expression, so an assert here makes every
/// \`MeridianTokens.light\` / \`.dark\` fail const evaluation — and \`dart analyze\`
/// over a directory does not report it, so the app analyses clean and then
/// fails in the compiler front-end at build time.
///
/// The invariant is real, so it is enforced where it can actually be checked:
/// the generator validates that stops and values are parallel and that there
/// are at least two samples before emitting this literal. A malformed curve is
/// a failed build of the generator, not a runtime assert nobody reaches.
@immutable
class MeridianSampledCurve extends Curve {
  const MeridianSampledCurve(this.stops, this.values);

  /// Input positions, 0 → 1, non-decreasing.
  final List<double> stops;

  /// Output values at each stop. May exceed 1 — that is what an overshoot is.
  final List<double> values;

  @override
  double transformInternal(double t) {
    if (t <= stops.first) return values.first;
    if (t >= stops.last) return values.last;
    for (int i = 1; i < stops.length; i += 1) {
      if (t <= stops[i]) {
        final double span = stops[i] - stops[i - 1];
        if (span <= 0.0) return values[i];
        final double local = (t - stops[i - 1]) / span;
        return values[i - 1] + (values[i] - values[i - 1]) * local;
      }
    }
    return values.last;
  }
}`;

const LERP_HELPERS = `double _lerpDouble(double a, double b, double t) => a + (b - a) * t;

Duration _lerpDuration(Duration a, Duration b, double t) => Duration(
      microseconds:
          (a.inMicroseconds + (b.inMicroseconds - a.inMicroseconds) * t).round(),
    );`;

/* ── the class ──────────────────────────────────────────────────────────── */

function tokensClass(extraction: TokenExtraction, fields: readonly FieldSpec[]): string[] {
  const lines: string[] = [];

  lines.push("/// Every design token in the system, typed, for both themes.");
  lines.push("///");
  lines.push("/// ```dart");
  lines.push("/// final tokens = Theme.of(context).extension<MeridianTokens>()!;");
  lines.push("/// ```");
  lines.push("@immutable");
  lines.push("class MeridianTokens extends ThemeExtension<MeridianTokens> {");
  lines.push("  const MeridianTokens({");
  for (const field of fields) lines.push(`    required this.${field.name},`);
  lines.push("  });");
  lines.push("");

  for (const field of fields) {
    lines.push(`  /// \`${field.property}\` — ${describe(field)}`);
    lines.push(`  final ${field.type} ${field.name};`);
    lines.push("");
  }

  lines.push(...instance("light", "The light theme — `:root`.", extraction.light, fields));
  lines.push("");
  lines.push(...instance("dark", "The dark theme — `:root` merged with `.dark`.", extraction.dark, fields));
  lines.push("");

  lines.push("  @override");
  lines.push("  MeridianTokens copyWith({");
  for (const field of fields) lines.push(`    ${field.type}? ${field.name},`);
  lines.push("  }) {");
  lines.push("    return MeridianTokens(");
  for (const field of fields) lines.push(`      ${field.name}: ${field.name} ?? this.${field.name},`);
  lines.push("    );");
  lines.push("  }");
  lines.push("");

  lines.push("  @override");
  lines.push("  MeridianTokens lerp(covariant ThemeExtension<MeridianTokens>? other, double t) {");
  lines.push("    if (other is! MeridianTokens) return this;");
  lines.push("    return MeridianTokens(");
  for (const field of fields) lines.push(`      ${field.name}: ${lerpExpression(field)},`);
  lines.push("    );");
  lines.push("  }");
  lines.push("}");

  return lines;
}

function instance(name: string, doc: string, set: TokenSet, fields: readonly FieldSpec[]): string[] {
  const lines: string[] = [`  /// ${doc}`, `  static const MeridianTokens ${name} = MeridianTokens(`];
  for (const field of fields) {
    const token = set[field.property];
    if (!token) {
      throw new Error(
        `The \`${name}\` theme has no value for ${field.property}. Every token must exist in both ` +
          "themes; the dark set is built by merging over light precisely so this cannot happen.",
      );
    }
    lines.push(`    ${field.name}: ${literal(token.value)},`);
  }
  lines.push("  );");
  return lines;
}

/* ── field typing ───────────────────────────────────────────────────────── */

interface FieldSpec {
  readonly property: string;
  readonly name: string;
  readonly type: string;
  readonly kind: TokenValue["kind"];
  readonly unit?: string;
}

/**
 * Members MeridianTokens already has. A token called `--light` would produce a
 * field that collides with `static const light`, and the failure would be a Dart
 * compile error in a generated file nobody wants to debug — so it fails here,
 * where the message can name the CSS property that caused it.
 */
const CLASS_MEMBERS = new Set(["light", "dark", "lerp", "copyWith", "hashCode", "toString", "runtimeType", "noSuchMethod"]);

function orderedFields(light: TokenSet, dark: TokenSet): FieldSpec[] {
  const fields: FieldSpec[] = [];

  for (const property of Object.keys(light)) {
    const lightToken = light[property] as ExtractedToken;
    if (CLASS_MEMBERS.has(lightToken.dartField)) {
      throw new Error(
        `${property} maps to the Dart field \`${lightToken.dartField}\`, which MeridianTokens already ` +
          "uses for a member of its own. Rename the custom property.",
      );
    }
    const darkToken = dark[property];
    if (darkToken && darkToken.value.kind !== lightToken.value.kind) {
      throw new Error(
        `${property} is a \`${lightToken.value.kind}\` in :root (line ${lightToken.line}) but a ` +
          `\`${darkToken.value.kind}\` in .dark (line ${darkToken.line}). A themed field has one Dart ` +
          "type; give the token the same shape in both scopes.",
      );
    }
    fields.push({
      property,
      name: lightToken.dartField,
      type: dartType(lightToken.value),
      kind: lightToken.value.kind,
      ...(lightToken.value.kind === "double" ? { unit: lightToken.value.unit } : {}),
    });
  }

  const extras = Object.keys(dark).filter((property) => !(property in light));
  if (extras.length > 0) {
    throw new Error(
      `.dark declares ${extras.join(", ")}, which :root never does. Add the token to :root so the ` +
        "light theme has a value for it — a theme field that exists in only one theme cannot lerp.",
    );
  }

  return fields;
}

export function dartType(value: TokenValue): string {
  switch (value.kind) {
    case "color":
      return "Color";
    case "double":
      return "double";
    case "duration":
      return "Duration";
    case "cubic":
      return "Cubic";
    case "curveSamples":
      return "MeridianSampledCurve";
    case "shadows":
      return "List<BoxShadow>";
    case "fluid":
      return "MeridianFluidSize";
    case "string":
      return "String";
  }
}

function describe(field: FieldSpec): string {
  switch (field.kind) {
    case "double":
      return field.unit === "percent"
        ? "a CSS percentage, carried as a 0–1 fraction."
        : field.unit === "ratio"
          ? "an aspect ratio, width ÷ height."
          : field.unit === "em"
            ? "an em multiple; multiply by the font size to get logical pixels."
            : field.unit === "ch"
              ? "a ch multiple; a measure, not a pixel length."
              : "logical pixels.";
    case "color":
      return "a colour at full alpha; compose with `.withValues(alpha: …)`.";
    case "shadows":
      return "an elevation stack, inset layers removed.";
    case "fluid":
      return "a fluid step; call `.resolve(width)`.";
    case "curveSamples":
      return "a sampled easing curve.";
    case "cubic":
      return "an easing curve.";
    case "duration":
      return "a duration.";
    case "string":
      return "a string token.";
  }
}

function lerpExpression(field: FieldSpec): string {
  const name = field.name;
  switch (field.kind) {
    case "color":
      return `Color.lerp(${name}, other.${name}, t)!`;
    case "double":
      return `_lerpDouble(${name}, other.${name}, t)`;
    case "duration":
      return `_lerpDuration(${name}, other.${name}, t)`;
    case "shadows":
      return `BoxShadow.lerpList(${name}, other.${name}, t)!`;
    case "fluid":
      return `MeridianFluidSize.lerp(${name}, other.${name}, t)`;
    // A curve or a family name has no midpoint that means anything: half of
    // Inter and half of Plex Arabic is not a font. Snap at the crossover.
    case "cubic":
    case "curveSamples":
    case "string":
      return `t < 0.5 ? ${name} : other.${name}`;
  }
}

/* ── literals ───────────────────────────────────────────────────────────── */

export function literal(value: TokenValue): string {
  switch (value.kind) {
    case "color":
      return `Color(${value.argb})`;
    case "double":
      return dartDouble(value.value);
    case "duration":
      return `Duration(microseconds: ${Math.round(value.milliseconds * 1000)})`;
    case "cubic":
      return `Cubic(${value.points.map(dartDouble).join(", ")})`;
    case "curveSamples": {
      // The invariant that used to be a Dart `assert` on the const constructor.
      // It cannot live there — Dart refuses to evaluate `List.length` in a const
      // expression, which makes every generated token fail const evaluation at
      // build time while `dart analyze` over a directory still reports clean.
      // Checking it here fails the generator instead, which is the only place
      // a malformed curve can still be fixed.
      if (value.samples.length < 2) {
        throw new Error(
          `curveSamples needs at least two samples to interpolate, got ${value.samples.length}`,
        );
      }
      for (let i = 1; i < value.samples.length; i += 1) {
        if (value.samples[i]!.t < value.samples[i - 1]!.t) {
          throw new Error(
            `curveSamples stops must be non-decreasing; sample ${i} (t=${value.samples[i]!.t}) ` +
              `precedes sample ${i - 1} (t=${value.samples[i - 1]!.t})`,
          );
        }
      }
      return (
        "MeridianSampledCurve(" +
        `<double>[${value.samples.map((s) => dartDouble(s.t)).join(", ")}], ` +
        `<double>[${value.samples.map((s) => dartDouble(s.value)).join(", ")}])`
      );
    }
    case "shadows":
      if (value.layers.length === 0) return "<BoxShadow>[]";
      return (
        "<BoxShadow>[" +
        value.layers
          .map(
            (layer) =>
              `BoxShadow(color: Color(${layer.argb}), ` +
              `offset: Offset(${dartDouble(layer.offsetX)}, ${dartDouble(layer.offsetY)}), ` +
              `blurRadius: ${dartDouble(layer.blurRadius)}, ` +
              `spreadRadius: ${dartDouble(layer.spreadRadius)})`,
          )
          .join(", ") +
        "]"
      );
    case "fluid":
      return (
        `MeridianFluidSize(minPx: ${dartDouble(value.minPx)}, maxPx: ${dartDouble(value.maxPx)}, ` +
        `basePx: ${dartDouble(value.basePx)}, remCoefficient: ${dartDouble(value.remCoefficient)}, ` +
        `vwCoefficient: ${dartDouble(value.vwCoefficient)})`
      );
    case "string":
      return dartString(value.value);
  }
}

/** Dart infers `int` from `1`, and `int` is not assignable to `double` in a const. */
export function dartDouble(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Refusing to emit a non-finite double: ${n}`);
  const rounded = Math.round(n * 1e6) / 1e6;
  return Number.isInteger(rounded) ? `${rounded}.0` : `${rounded}`;
}

/**
 * Double-quoted, because `--noise` is an SVG data URI whose attributes are
 * single-quoted (`xmlns='…'`). `$` is escaped because Dart interpolates it.
 */
export function dartString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/\$/g, "\\$")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
  return `"${escaped}"`;
}
