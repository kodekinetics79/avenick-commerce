/**
 * `var()` and `calc()` resolution, then coercion, per scope.
 *
 * The subtle part is WHERE a `var()` resolves. CSS resolves it at the USE site,
 * not the declaration site, so `--neutral-ink: var(--ink-2)` declared once in
 * `:root` is a different colour under `.dark` — because `.dark` redeclares
 * `--ink-2`. An extractor that resolves aliases against `:root` only would emit
 * a dark theme whose secondary ink is the light theme's, and it would look
 * plausible enough to ship.
 *
 * So each scope resolves against its OWN merged map: light for the base, and
 * `{...light, ...delta}` for every scope layered on top of it. That is exactly
 * the cascade, and it is why the dark theme's `--background`, `--state-mix`,
 * `--field-rule` and the whole `--elev-*` stack come out right.
 */

import { RTL_EMITTED_PREFIXES, UnsupportedValueError, type TokenScopeId } from "./scopes";
import type { RawDeclaration } from "./parse-css";
import { coerceValue, splitTopLevel, type GenerationWarning, type TokenValue } from "./values";

export interface ResolvedToken {
  readonly property: string;
  /** The declaration text after `var()` and `calc()` resolution. */
  readonly resolved: string;
  readonly raw: string;
  readonly line: number;
  readonly value: TokenValue;
}

export interface ResolvedScope {
  readonly id: TokenScopeId;
  readonly tokens: ReadonlyMap<string, ResolvedToken>;
}

export interface ResolveResult {
  readonly scope: ResolvedScope;
  readonly warnings: readonly GenerationWarning[];
}

/**
 * @param declared    the properties this scope should EMIT (its own deltas, or
 *                    the whole base set for light).
 * @param merged      what `var()` resolves against — the cascade at this scope.
 * @param onlyPrefixes  if given, emit only properties starting with one of these.
 */
export function resolveScope(
  id: TokenScopeId,
  declared: ReadonlyMap<string, RawDeclaration>,
  merged: ReadonlyMap<string, RawDeclaration>,
  sourceFile: string,
  onlyPrefixes?: readonly string[],
): ResolveResult {
  const tokens = new Map<string, ResolvedToken>();
  const warnings: GenerationWarning[] = [];

  for (const [property, declaration] of declared) {
    if (onlyPrefixes && !onlyPrefixes.some((prefix) => property.startsWith(prefix))) {
      warnings.push({
        kind: "rtl-delta-not-emitted",
        property,
        scope: id,
        line: declaration.line,
        detail:
          `${property}: ${declaration.value} — declared under [dir="rtl"] but not emitted. ` +
          `Only ${RTL_EMITTED_PREFIXES.join(", ")} crosses to Flutter; the Arabic size ramp is ` +
          "tuned against the web's fluid clamps and would be wrong resolved on a phone.",
      });
      continue;
    }

    const site = { property, scope: id, sourceFile, line: declaration.line };
    const substituted = evaluateCalc(substituteVars(declaration.value, merged, new Set([property]), site), site);
    const coerced = coerceValue(substituted, site);
    warnings.push(...coerced.warnings);
    tokens.set(property, {
      property,
      resolved: substituted,
      raw: declaration.value,
      line: declaration.line,
      value: coerced.value,
    });
  }

  return { scope: { id, tokens }, warnings };
}

/** `{...base, ...delta}` at the raw-text level — the cascade, one layer deep. */
export function mergeRaw(
  base: ReadonlyMap<string, RawDeclaration>,
  delta: ReadonlyMap<string, RawDeclaration> | undefined,
): Map<string, RawDeclaration> {
  const merged = new Map(base);
  if (delta) for (const [property, declaration] of delta) merged.set(property, declaration);
  return merged;
}

interface Site {
  readonly property: string;
  readonly scope: string;
  readonly sourceFile: string;
  readonly line: number;
}

/* ── var() ──────────────────────────────────────────────────────────────── */

function substituteVars(
  text: string,
  merged: ReadonlyMap<string, RawDeclaration>,
  seen: ReadonlySet<string>,
  site: Site,
): string {
  let out = "";
  let index = 0;

  while (index < text.length) {
    const start = text.indexOf("var(", index);
    if (start === -1) {
      out += text.slice(index);
      break;
    }
    out += text.slice(index, start);

    const end = matchParen(text, start + "var(".length - 1);
    if (end === -1) {
      throw new UnsupportedValueError(site.property, text, site.sourceFile, site.line, "Unbalanced var().");
    }

    const inner = text.slice(start + "var(".length, end);
    const [nameRaw, ...fallbackParts] = splitTopLevel(inner, ",");
    const name = (nameRaw ?? "").trim();
    const fallback = fallbackParts.join(", ").trim();

    if (seen.has(name)) {
      throw new UnsupportedValueError(
        site.property,
        text,
        site.sourceFile,
        site.line,
        `Circular var() reference through ${name}.`,
      );
    }

    const target = merged.get(name);
    if (target) {
      out += substituteVars(target.value, merged, new Set([...seen, name]), site);
    } else if (fallback.length > 0) {
      out += substituteVars(fallback, merged, new Set([...seen, name]), site);
    } else {
      throw new UnsupportedValueError(
        site.property,
        text,
        site.sourceFile,
        site.line,
        `${name} is referenced but never declared in this scope, and there is no fallback. ` +
          "In the browser that silently yields the property's initial value; here it is a build error.",
      );
    }

    index = end + 1;
  }

  return out;
}

/* ── calc() ─────────────────────────────────────────────────────────────── */

interface Dimension {
  readonly n: number;
  readonly unit: string;
}

/**
 * Evaluates every `calc()` in a value to a literal. The motion tokens are the
 * only users — `calc(var(--dur-3) * var(--motion-scale))` — but that one
 * multiplication is what makes the whole reduced-motion and portal-posture
 * system work, so it has to be evaluated rather than skipped: at
 * `--motion-scale: 0` the correct answer is a zero Duration, and at admin's
 * `.65` it is 143ms.
 */
function evaluateCalc(text: string, site: Site): string {
  let out = text;
  let guard = 0;
  while (out.includes("calc(")) {
    if ((guard += 1) > 32) {
      throw new UnsupportedValueError(site.property, text, site.sourceFile, site.line, "calc() nesting is too deep.");
    }
    // Innermost first: the last `calc(` has no calc inside it.
    const start = out.lastIndexOf("calc(");
    const end = matchParen(out, start + "calc(".length - 1);
    if (end === -1) {
      throw new UnsupportedValueError(site.property, text, site.sourceFile, site.line, "Unbalanced calc().");
    }
    const result = evaluateExpression(out.slice(start + "calc(".length, end), site);
    out = `${out.slice(0, start)}${formatDimension(result)}${out.slice(end + 1)}`;
  }
  return out;
}

function evaluateExpression(expression: string, site: Site): Dimension {
  const tokens = tokeniseExpression(expression, site);
  let position = 0;

  const peek = (): string | undefined => tokens[position];

  const parsePrimary = (): Dimension => {
    const token = tokens[position];
    if (token === undefined) {
      throw new UnsupportedValueError(site.property, expression, site.sourceFile, site.line, "calc() ended early.");
    }
    position += 1;
    if (token === "(") {
      const inner = parseSum();
      if (tokens[position] !== ")") {
        throw new UnsupportedValueError(
          site.property,
          expression,
          site.sourceFile,
          site.line,
          "Unbalanced parentheses inside calc().",
        );
      }
      position += 1;
      return inner;
    }
    const match = /^(-?(?:\d+\.\d+|\d+\.|\.\d+|\d+))([a-z%]*)$/.exec(token);
    if (!match) {
      throw new UnsupportedValueError(
        site.property,
        expression,
        site.sourceFile,
        site.line,
        `\`${token}\` is not a number calc() can evaluate.`,
      );
    }
    return { n: Number(match[1]), unit: match[2] ?? "" };
  };

  const parseProduct = (): Dimension => {
    let left = parsePrimary();
    while (peek() === "*" || peek() === "/") {
      const operator = tokens[position];
      position += 1;
      const right = parsePrimary();
      if (operator === "*") {
        if (left.unit && right.unit) {
          throw new UnsupportedValueError(
            site.property,
            expression,
            site.sourceFile,
            site.line,
            `Cannot multiply ${left.unit} by ${right.unit}.`,
          );
        }
        left = { n: left.n * right.n, unit: left.unit || right.unit };
      } else {
        if (right.unit) {
          throw new UnsupportedValueError(
            site.property,
            expression,
            site.sourceFile,
            site.line,
            "calc() division needs a unitless divisor.",
          );
        }
        left = { n: left.n / right.n, unit: left.unit };
      }
    }
    return left;
  };

  const parseSum = (): Dimension => {
    let left = parseProduct();
    while (peek() === "+" || peek() === "-") {
      const operator = tokens[position];
      position += 1;
      const right = parseProduct();
      const unit = left.n === 0 && !left.unit ? right.unit : left.unit;
      if (right.unit && left.unit && right.unit !== left.unit) {
        throw new UnsupportedValueError(
          site.property,
          expression,
          site.sourceFile,
          site.line,
          `Cannot add ${left.unit} to ${right.unit}.`,
        );
      }
      left = { n: operator === "+" ? left.n + right.n : left.n - right.n, unit: unit || right.unit };
    }
    return left;
  };

  const value = parseSum();
  if (position !== tokens.length) {
    throw new UnsupportedValueError(
      site.property,
      expression,
      site.sourceFile,
      site.line,
      "Trailing tokens after the calc() expression.",
    );
  }
  return value;
}

function tokeniseExpression(expression: string, site: Site): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index] as string;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if ("()+*/".includes(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }
    // `-` is a subtraction operator only when surrounded by whitespace; CSS
    // requires that precisely because `-2px` is a negative length.
    if (char === "-" && expression[index - 1] === " " && expression[index + 1] === " ") {
      tokens.push("-");
      index += 1;
      continue;
    }
    const match = /^-?[\d.]+[a-z%]*/.exec(expression.slice(index));
    if (!match) {
      throw new UnsupportedValueError(
        site.property,
        expression,
        site.sourceFile,
        site.line,
        `Unexpected \`${char}\` inside calc().`,
      );
    }
    tokens.push(match[0]);
    index += match[0].length;
  }
  return tokens;
}

function formatDimension(dimension: Dimension): string {
  const rounded = Math.round(dimension.n * 1e6) / 1e6;
  return `${rounded}${dimension.unit}`;
}

/** Index of the `)` matching the `(` at `openIndex`, or -1. */
function matchParen(text: string, openIndex: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}
