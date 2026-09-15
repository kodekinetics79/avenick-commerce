/**
 * The extraction: globals.css in, a fully typed token set out.
 */

import { createHash } from "node:crypto";

import { parseStylesheet, type RegisteredProperty } from "./parse-css";
import { mergeRaw, resolveScope, type ResolvedToken } from "./resolve";
import { RTL_EMITTED_PREFIXES, type TokenScopeId } from "./scopes";
import type { GenerationWarning, TokenValue } from "./values";

export interface ExtractedToken {
  /** The CSS custom property, e.g. `--surface-0`. */
  readonly property: string;
  /** The lowerCamelCase Dart field, e.g. `surface0`. */
  readonly dartField: string;
  /** The declaration text after var()/calc() resolution. */
  readonly resolved: string;
  /** The declaration text as written. */
  readonly raw: string;
  readonly line: number;
  readonly value: TokenValue;
}

export type TokenSet = Readonly<Record<string, ExtractedToken>>;

export interface TokenExtraction {
  readonly source: {
    readonly file: string;
    readonly sha256: string;
    readonly bytes: number;
  };
  /** CSS `@property` registrations — the stylesheet's own type annotations. */
  readonly registeredProperties: readonly RegisteredProperty[];
  /** The base set. */
  readonly light: TokenSet;
  /** Light merged with `.dark` and re-resolved in the dark cascade. */
  readonly dark: TokenSet;
  /** Property names `.dark` actually redeclares. */
  readonly darkOverrides: readonly string[];
  /** Posture deltas only — captured, not shipped to the customer mobile app. */
  readonly portalSeller: TokenSet;
  readonly portalAdmin: TokenSet;
  /** `@media (prefers-reduced-motion: reduce) :root` deltas only. */
  readonly reducedMotion: TokenSet;
  /** `[dir="rtl"]` font-family overrides only; the rest is in `warnings`. */
  readonly rtl: TokenSet;
  readonly warnings: readonly GenerationWarning[];
}

export function extractTokens(css: string, sourceFile: string): TokenExtraction {
  const parsed = parseStylesheet(css, sourceFile);
  const warnings: GenerationWarning[] = [];

  const raw = (id: TokenScopeId) => parsed.scopes.get(id) ?? new Map();
  const lightRaw = raw("light");
  if (lightRaw.size === 0) {
    throw new Error(
      `${sourceFile} declared no custom properties on :root. Either the file moved or the ` +
        "selector changed; packages/design-tokens will not emit an empty theme.",
    );
  }

  const darkMerged = mergeRaw(lightRaw, raw("dark"));
  const sellerMerged = mergeRaw(lightRaw, raw("portalSeller"));
  const adminMerged = mergeRaw(lightRaw, raw("portalAdmin"));
  const reducedMerged = mergeRaw(lightRaw, raw("reducedMotion"));
  const rtlMerged = mergeRaw(lightRaw, raw("rtl"));

  const light = collect(resolveInto("light", lightRaw, lightRaw));
  // `dark` resolves the WHOLE base set again, not just the overrides: aliases
  // like `--background: var(--surface-0)` are declared once in :root but mean
  // something different once `.dark` has moved `--surface-0`.
  const dark = collect(resolveInto("dark", darkMerged, darkMerged));
  const portalSeller = collect(resolveInto("portalSeller", raw("portalSeller"), sellerMerged));
  const portalAdmin = collect(resolveInto("portalAdmin", raw("portalAdmin"), adminMerged));
  const reducedMotion = collect(resolveInto("reducedMotion", raw("reducedMotion"), reducedMerged));
  const rtl = collect(resolveInto("rtl", raw("rtl"), rtlMerged, RTL_EMITTED_PREFIXES));

  return {
    source: {
      file: sourceFile,
      sha256: createHash("sha256").update(css, "utf8").digest("hex"),
      bytes: Buffer.byteLength(css, "utf8"),
    },
    registeredProperties: parsed.registeredProperties,
    light,
    dark,
    darkOverrides: [...raw("dark").keys()],
    portalSeller,
    portalAdmin,
    reducedMotion,
    rtl,
    warnings,
  };

  function resolveInto(
    id: TokenScopeId,
    declared: ReadonlyMap<string, { property: string; value: string; line: number }>,
    merged: ReadonlyMap<string, { property: string; value: string; line: number }>,
    onlyPrefixes?: readonly string[],
  ): ReadonlyMap<string, ResolvedToken> {
    const result = resolveScope(id, declared, merged, sourceFile, onlyPrefixes);
    warnings.push(...result.warnings);
    return result.scope.tokens;
  }
}

function collect(tokens: ReadonlyMap<string, ResolvedToken>): TokenSet {
  const out: Record<string, ExtractedToken> = {};
  const claimed = new Map<string, string>();
  for (const [property, token] of tokens) {
    const dartField = toDartField(property);
    const previous = claimed.get(dartField);
    if (previous !== undefined) {
      throw new Error(
        `${property} and ${previous} both map to the Dart field \`${dartField}\`. ` +
          "Rename one of the custom properties; a generated theme cannot carry two of the same field.",
      );
    }
    claimed.set(dartField, property);
    out[property] = { ...token, dartField };
  }
  return out;
}

/** Dart reserved words that could collide with a token name. */
const DART_RESERVED = new Set([
  "abstract", "as", "assert", "async", "await", "break", "case", "catch", "class", "const", "continue",
  "covariant", "default", "deferred", "do", "dynamic", "else", "enum", "export", "extends", "extension",
  "external", "factory", "false", "final", "finally", "for", "function", "get", "hide", "if", "implements",
  "import", "in", "interface", "is", "late", "library", "mixin", "new", "null", "on", "operator", "part",
  "required", "rethrow", "return", "set", "show", "static", "super", "switch", "sync", "this", "throw",
  "true", "try", "typedef", "var", "void", "while", "with", "yield",
]);

/** `--fs-h1` → `fsH1`, `--surface-0` → `surface0`, `--ease-in-out` → `easeInOut`. */
export function toDartField(property: string): string {
  const segments = property.replace(/^--/, "").split("-").filter(Boolean);
  if (segments.length === 0) throw new Error(`Cannot derive a Dart field name from \`${property}\`.`);
  const [head, ...tail] = segments;
  const name =
    (head as string) + tail.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join("");
  return DART_RESERVED.has(name) ? `${name}$` : name;
}
