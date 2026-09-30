/**
 * Typed coercion: CSS text → a value the Dart emitter can type.
 *
 * The rule this file is built on: a token the generator cannot type is a token
 * the Flutter app would receive as a GUESS. So every branch either produces a
 * value with a known Dart type, or throws {@link UnsupportedValueError} citing
 * the source line. There is no `unknown`, no passthrough string escape hatch,
 * and no "best effort".
 *
 * Input here has already had `var()` and `calc()` resolved (see resolve.ts), so
 * `hsl(var(--rim) / var(--rim-2))` arrives as `hsl(0 0% 100% / .72)`.
 */

import { hslToRgba, toArgbHex, type RgbaColor } from "./color";
import { SHADOW_TOKEN_PATTERN, UnsupportedValueError } from "./scopes";

/** Units that all land on a Dart `double`, kept so JSON consumers know what they got. */
export type DoubleUnit = "px" | "rem" | "em" | "ch" | "percent" | "ratio" | "none" | "deg";

export interface BoxShadowLayer {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blurRadius: number;
  readonly spreadRadius: number;
  readonly color: RgbaColor;
  /** `0xAARRGGBB`. */
  readonly argb: string;
}

export interface CurveSample {
  /** 0–1 along the timeline. */
  readonly t: number;
  readonly value: number;
}

export type TokenValue =
  | { readonly kind: "color"; readonly hsl: readonly [number, number, number]; readonly rgba: RgbaColor; readonly argb: string }
  | { readonly kind: "double"; readonly value: number; readonly unit: DoubleUnit }
  | { readonly kind: "duration"; readonly milliseconds: number }
  | { readonly kind: "cubic"; readonly points: readonly [number, number, number, number] }
  | { readonly kind: "curveSamples"; readonly samples: readonly CurveSample[] }
  | { readonly kind: "shadows"; readonly layers: readonly BoxShadowLayer[] }
  | {
      readonly kind: "fluid";
      readonly minPx: number;
      readonly maxPx: number;
      readonly basePx: number;
      readonly remCoefficient: number;
      readonly vwCoefficient: number;
    }
  | { readonly kind: "string"; readonly value: string; readonly role: "fontFamily" | "keyword" | "uri" };

export type TokenValueKind = TokenValue["kind"];

export interface GenerationWarning {
  readonly kind: "inset-shadow-dropped" | "rtl-delta-not-emitted" | "approximated-on-flutter";
  readonly property: string;
  readonly scope: string;
  readonly line: number;
  readonly detail: string;
}

export interface CoercionSite {
  readonly property: string;
  readonly scope: string;
  readonly sourceFile: string;
  readonly line: number;
}

export interface CoercionResult {
  readonly value: TokenValue;
  readonly warnings: readonly GenerationWarning[];
}

const NUMBER = String.raw`-?(?:\d+\.\d+|\d+\.|\.\d+|\d+)`;
const DIMENSION_RE = new RegExp(`^(${NUMBER})(px|rem|em|ch|%|ms|s|deg|vw)?$`);
const HSL_TRIPLE_RE = new RegExp(`^(${NUMBER})\\s+(${NUMBER})%\\s+(${NUMBER})%$`);
const RATIO_RE = new RegExp(`^(${NUMBER})\\s*/\\s*(${NUMBER})$`);
const HSL_FN_RE = new RegExp(
  `^hsla?\\(\\s*(${NUMBER})\\s+(${NUMBER})%\\s+(${NUMBER})%\\s*(?:/\\s*(${NUMBER}%?)\\s*)?\\)$`,
);

/** The one length keyword the type ramp uses; anything else is a build error. */
const KEYWORDS = new Set(["left", "right", "none", "auto"]);

export function coerceValue(text: string, site: CoercionSite): CoercionResult {
  const value = text.replace(/\s+/g, " ").trim();
  const warnings: GenerationWarning[] = [];

  // --elev-0 is `none`, and on a Flutter surface "no shadow" is an empty list,
  // not the string "none". Resolved by token NAME because the value alone is
  // ambiguous with the `none` keyword used elsewhere.
  if (SHADOW_TOKEN_PATTERN.test(site.property)) {
    return { value: parseShadowList(value, site, warnings), warnings };
  }

  if (value.startsWith("url(")) {
    return { value: { kind: "string", value: stripUrl(value, site), role: "uri" }, warnings };
  }

  if (value.startsWith("clamp(")) {
    return { value: parseClamp(value, site), warnings };
  }

  if (value.startsWith("cubic-bezier(")) {
    return { value: parseCubicBezier(value, site), warnings };
  }

  if (value.startsWith("linear(")) {
    warnings.push({
      kind: "approximated-on-flutter",
      property: site.property,
      scope: site.scope,
      line: site.line,
      detail:
        "CSS linear() has no Flutter equivalent; emitted as MeridianSampledCurve, " +
        "which linearly interpolates the same sample points. Visually equivalent, " +
        "but it is a sampled curve rather than a closed form.",
    });
    return { value: parseLinearCurve(value, site), warnings };
  }

  if (value.startsWith('"') || value.startsWith("'")) {
    return { value: { kind: "string", value: value.slice(1, -1), role: "fontFamily" }, warnings };
  }

  const hslTriple = HSL_TRIPLE_RE.exec(value);
  if (hslTriple) {
    const h = Number(hslTriple[1]);
    const s = Number(hslTriple[2]);
    const l = Number(hslTriple[3]);
    const rgba = hslToRgba(h, s, l, 1);
    return { value: { kind: "color", hsl: [h, s, l], rgba, argb: toArgbHex(rgba) }, warnings };
  }

  const ratio = RATIO_RE.exec(value);
  if (ratio) {
    const denominator = Number(ratio[2]);
    if (denominator === 0) {
      throw new UnsupportedValueError(site.property, text, site.sourceFile, site.line, "Aspect ratio divides by zero.");
    }
    return { value: { kind: "double", value: Number(ratio[1]) / denominator, unit: "ratio" }, warnings };
  }

  const dimension = DIMENSION_RE.exec(value);
  if (dimension) {
    const magnitude = Number(dimension[1]);
    const unit = dimension[2];
    if (unit === "ms") return { value: { kind: "duration", milliseconds: magnitude }, warnings };
    if (unit === "s") return { value: { kind: "duration", milliseconds: magnitude * 1000 }, warnings };
    if (unit === "%") return { value: { kind: "double", value: magnitude / 100, unit: "percent" }, warnings };
    if (unit === "vw") {
      throw new UnsupportedValueError(
        site.property,
        text,
        site.sourceFile,
        site.line,
        "A bare viewport unit has no fixed value on a phone. Express it as a clamp() so the generator can emit a MeridianFluidSize.",
      );
    }
    return {
      value: { kind: "double", value: magnitude, unit: (unit as DoubleUnit | undefined) ?? "none" },
      warnings,
    };
  }

  if (KEYWORDS.has(value)) {
    return { value: { kind: "string", value, role: "keyword" }, warnings };
  }

  if (value.includes("hsl(") || value.startsWith("inset ")) {
    return { value: parseShadowList(value, site, warnings), warnings };
  }

  throw new UnsupportedValueError(
    site.property,
    text,
    site.sourceFile,
    site.line,
    "No coercion matched. Recognised shapes: an HSL triple, a length/number/percentage, " +
      "a duration, a ratio, clamp(), cubic-bezier(), linear(), url(), a quoted font family, " +
      `a box-shadow list, or one of the keywords ${[...KEYWORDS].join(" / ")}.`,
  );
}

/* ── box-shadow ─────────────────────────────────────────────────────────── */

/**
 * Flutter has NO inset shadow. `BoxShadow` paints outside the box, full stop —
 * there is no `BoxShadow.inset`, and an inner shadow needs a whole different
 * mechanism (a decorated child, or a custom painter).
 *
 * That matters more here than it would in most systems, because Meridian's
 * light model puts three of its four optical events INSIDE the box: the
 * highlight seam, the counter-fresnel underside, and half of --elev-1. Dropping
 * them silently would make every raised surface on mobile a shadow under a
 * rectangle, which is exactly the defect the design system was written to fix.
 *
 * So each dropped layer is collected and printed at the end of generation. The
 * web/mobile delta becomes a list somebody can read, rather than an absence.
 */
function parseShadowList(value: string, site: CoercionSite, warnings: GenerationWarning[]): TokenValue {
  if (value === "none") return { kind: "shadows", layers: [] };

  const layers: BoxShadowLayer[] = [];
  for (const raw of splitTopLevel(value, ",")) {
    const layer = raw.trim();
    if (!layer) continue;

    const parts = splitTopLevel(layer, " ").filter(Boolean);
    if (parts[0] === "inset") {
      warnings.push({
        kind: "inset-shadow-dropped",
        property: site.property,
        scope: site.scope,
        line: site.line,
        detail: `inset layer dropped: \`${layer}\` (Flutter BoxShadow cannot paint inside the box)`,
      });
      continue;
    }
    if (parts.includes("inset")) {
      throw new UnsupportedValueError(
        site.property,
        value,
        site.sourceFile,
        site.line,
        "`inset` appears somewhere other than the head of a shadow layer; the generator only handles the leading form.",
      );
    }

    const colourText = parts[parts.length - 1];
    const lengths = parts.slice(0, -1);
    if (lengths.length < 2 || lengths.length > 4) {
      throw new UnsupportedValueError(
        site.property,
        value,
        site.sourceFile,
        site.line,
        `Shadow layer \`${layer}\` has ${lengths.length} length(s); expected 2–4 followed by a colour.`,
      );
    }

    const [offsetX, offsetY, blurRadius = 0, spreadRadius = 0] = lengths.map((l) => parseLength(l, value, site));
    const colour = parseHslFunction(colourText ?? "", value, site);
    layers.push({
      offsetX,
      offsetY,
      blurRadius,
      spreadRadius,
      color: colour,
      argb: toArgbHex(colour),
    });
  }
  return { kind: "shadows", layers };
}

/**
 * The CSS root font size, in px.
 *
 * `rem` is relative to the ROOT element, and `packages/ui/src/globals.css` sets
 * no `font-size` on `html` — the `font-size: var(--fs-body)` in section 5 is on
 * `body`, which does not move `rem`. So a rem here is the browser default, 16px.
 *
 * If a `font-size` is ever added to the `html` rule, this constant is wrong and
 * every rem-valued bound silently shifts. The scope regression test asserts the
 * html rule declares no font-size, so that change breaks the build instead.
 */
const ROOT_FONT_PX = 16;

function parseLength(text: string, whole: string, site: CoercionSite): number {
  const match = DIMENSION_RE.exec(text);
  const unit = match?.[2];

  // `rem` is admitted because absolute bounds are legitimately written in it —
  // `--shell-gutter: clamp(1rem, 3vw, 3rem)`. `em` is NOT: it resolves against
  // the element's own font size, which a stylesheet-wide extractor cannot know,
  // so accepting it would mean guessing. That is the one thing this generator
  // refuses to do.
  if (!match || (unit !== undefined && unit !== "px" && unit !== "rem")) {
    throw new UnsupportedValueError(
      site.property,
      whole,
      site.sourceFile,
      site.line,
      `Expected a px or rem length, or a bare 0, got \`${text}\`.` +
        (unit === "em"
          ? " `em` resolves against the element's own font size, which this extractor cannot know — use rem or px."
          : ""),
    );
  }

  const magnitude = Number(match[1]);
  return unit === "rem" ? magnitude * ROOT_FONT_PX : magnitude;
}

function parseHslFunction(text: string, whole: string, site: CoercionSite): RgbaColor {
  const match = HSL_FN_RE.exec(text);
  if (!match) {
    throw new UnsupportedValueError(
      site.property,
      whole,
      site.sourceFile,
      site.line,
      `Expected a shadow colour of the form hsl(H S% L% / A), got \`${text}\`. ` +
        "Every colour in this system is an HSL triple composed with alpha at the call site.",
    );
  }
  const alphaText = match[4];
  const alpha =
    alphaText === undefined ? 1 : alphaText.endsWith("%") ? Number(alphaText.slice(0, -1)) / 100 : Number(alphaText);
  return hslToRgba(Number(match[1]), Number(match[2]), Number(match[3]), alpha);
}

/* ── clamp() ────────────────────────────────────────────────────────────── */

/**
 * The fluid type ramp. `clamp(40px, 1.293rem + 4.95vw, 92px)`.
 *
 * Collapsing this to its MINIMUM would have been the easy call — a phone is
 * near the 390px end of the 390→1440 range the clamps were computed for — but
 * "mobile" now includes tablets and foldables, where the preferred term is live
 * and the difference between 40px and 92px is the whole hero rung. So both ends
 * and the slope survive into Dart as a MeridianFluidSize.
 */
function parseClamp(value: string, site: CoercionSite): TokenValue {
  const inner = value.slice("clamp(".length, -1);
  const args = splitTopLevel(inner, ",").map((a) => a.trim());
  if (args.length !== 3) {
    throw new UnsupportedValueError(
      site.property,
      value,
      site.sourceFile,
      site.line,
      `clamp() needs exactly 3 arguments, got ${args.length}.`,
    );
  }

  const minPx = parseLength(args[0] ?? "", value, site);
  const maxPx = parseLength(args[2] ?? "", value, site);

  let basePx = 0;
  let remCoefficient = 0;
  let vwCoefficient = 0;
  for (const term of splitPreferredTerms(args[1] ?? "", value, site)) {
    const match = DIMENSION_RE.exec(term.text);
    if (!match) {
      throw new UnsupportedValueError(
        site.property,
        value,
        site.sourceFile,
        site.line,
        `Unparseable term \`${term.text}\` in the preferred half of clamp().`,
      );
    }
    const magnitude = Number(match[1]) * term.sign;
    switch (match[2]) {
      case "px":
        basePx += magnitude;
        break;
      case "rem":
        remCoefficient += magnitude;
        break;
      case "vw":
        vwCoefficient += magnitude;
        break;
      default:
        throw new UnsupportedValueError(
          site.property,
          value,
          site.sourceFile,
          site.line,
          `clamp()'s preferred value only supports px / rem / vw terms, got \`${term.text}\`.`,
        );
    }
  }

  return { kind: "fluid", minPx, maxPx, basePx, remCoefficient, vwCoefficient };
}

function splitPreferredTerms(
  text: string,
  whole: string,
  site: CoercionSite,
): { text: string; sign: number }[] {
  const parts = text.split(/\s+/).filter(Boolean);
  const terms: { text: string; sign: number }[] = [];
  let sign = 1;
  for (const part of parts) {
    if (part === "+") {
      sign = 1;
      continue;
    }
    if (part === "-") {
      sign = -1;
      continue;
    }
    if (part === "*" || part === "/") {
      throw new UnsupportedValueError(
        site.property,
        whole,
        site.sourceFile,
        site.line,
        "clamp()'s preferred value is only handled as a sum of terms; multiplication would need a full calc evaluator here.",
      );
    }
    terms.push({ text: part, sign });
    sign = 1;
  }
  return terms;
}

/* ── easing ─────────────────────────────────────────────────────────────── */

function parseCubicBezier(value: string, site: CoercionSite): TokenValue {
  const args = splitTopLevel(value.slice("cubic-bezier(".length, -1), ",");
  if (args.length !== 4) {
    throw new UnsupportedValueError(
      site.property,
      value,
      site.sourceFile,
      site.line,
      `cubic-bezier() needs exactly 4 control values, got ${args.length}.`,
    );
  }
  const points = args.map((a) => {
    const n = Number(a.trim());
    if (!Number.isFinite(n)) {
      throw new UnsupportedValueError(
        site.property,
        value,
        site.sourceFile,
        site.line,
        `cubic-bezier() control value \`${a.trim()}\` is not a number.`,
      );
    }
    return n;
  }) as [number, number, number, number];
  return { kind: "cubic", points };
}

/**
 * CSS `linear()`: a list of output values, some carrying an explicit input
 * stop. Entries without a stop are distributed evenly between the surrounding
 * explicit ones — which is the part a naive reader gets wrong, and it matters,
 * because --ease-spring's overshoot peak sits between two explicit stops.
 */
function parseLinearCurve(value: string, site: CoercionSite): TokenValue {
  const entries = splitTopLevel(value.slice("linear(".length, -1), ",").map((e) => e.trim());
  const parsed: { value: number; stop: number | undefined }[] = [];

  for (const entry of entries) {
    const parts = entry.split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    if (parts.length > 2) {
      throw new UnsupportedValueError(
        site.property,
        value,
        site.sourceFile,
        site.line,
        `linear() entry \`${entry}\` carries two input stops; the generator only handles the single-stop form.`,
      );
    }
    const output = Number(parts[0]);
    if (!Number.isFinite(output)) {
      throw new UnsupportedValueError(
        site.property,
        value,
        site.sourceFile,
        site.line,
        `linear() entry \`${entry}\` has a non-numeric output.`,
      );
    }
    let stop: number | undefined;
    if (parts.length === 2) {
      const raw = parts[1] ?? "";
      if (!raw.endsWith("%")) {
        throw new UnsupportedValueError(
          site.property,
          value,
          site.sourceFile,
          site.line,
          `linear() input stop \`${raw}\` must be a percentage.`,
        );
      }
      stop = Number(raw.slice(0, -1)) / 100;
    }
    parsed.push({ value: output, stop });
  }

  if (parsed.length < 2) {
    throw new UnsupportedValueError(
      site.property,
      value,
      site.sourceFile,
      site.line,
      "linear() needs at least two entries to describe a curve.",
    );
  }

  // Per spec: the first stop defaults to 0, the last to 1, each explicit stop is
  // clamped to be >= the one before it, and runs of implicit stops interpolate.
  const stops: (number | undefined)[] = parsed.map((p) => p.stop);
  if (stops[0] === undefined) stops[0] = 0;
  if (stops[stops.length - 1] === undefined) stops[stops.length - 1] = 1;
  let previous = stops[0] as number;
  for (let i = 0; i < stops.length; i += 1) {
    const current = stops[i];
    if (current === undefined) continue;
    stops[i] = Math.max(current, previous);
    previous = stops[i] as number;
  }
  for (let i = 0; i < stops.length; i += 1) {
    if (stops[i] !== undefined) continue;
    let end = i;
    while (stops[end] === undefined) end += 1;
    const before = stops[i - 1] as number;
    const after = stops[end] as number;
    const steps = end - i + 1;
    for (let k = i; k < end; k += 1) {
      stops[k] = before + ((after - before) * (k - i + 1)) / steps;
    }
    i = end - 1;
  }

  return {
    kind: "curveSamples",
    samples: parsed.map((p, i) => ({ t: round6(stops[i] as number), value: p.value })),
  };
}

/* ── helpers ────────────────────────────────────────────────────────────── */

function stripUrl(value: string, site: CoercionSite): string {
  const inner = value.slice("url(".length, -1).trim();
  if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
    return inner.slice(1, -1);
  }
  if (inner.length === 0) {
    throw new UnsupportedValueError(site.property, value, site.sourceFile, site.line, "Empty url().");
  }
  return inner;
}

/**
 * Splits on a separator that is not inside parentheses or a quoted string.
 * `--noise` is a data URI full of commas and parens, and `--elev-4` is a comma
 * list of layers each containing a parenthesised colour, so a plain `.split()`
 * mangles both.
 */
export function splitTopLevel(text: string, separator: "," | " "): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = "";

  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0 && (char === separator || (separator === " " && /\s/.test(char)))) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return separator === "," ? out.map((s) => s.trim()) : out.map((s) => s.trim()).filter(Boolean);
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
