/**
 * @avenick/design-tokens
 *
 * `packages/ui/src/globals.css` is the only place design tokens are defined —
 * three web portals already @import it. Flutter cannot, so this package parses
 * that stylesheet and emits the same tokens as a typed Dart `ThemeExtension`,
 * plus a plain JSON extraction that web tooling and tests read.
 *
 * The direction of the arrow is the point: mobile is a CONSUMER of the web's
 * token file, never a second copy of it. The moment the two could disagree,
 * `tokens:generate` is the thing that has to fail.
 */

export { hslToRgba, toArgbHex, type RgbaColor } from "./color";
export { extractTokens, toDartField, type ExtractedToken, type TokenExtraction, type TokenSet } from "./extract";
export { emitDart, dartType, literal, type DartEmission } from "./dart";
export { parseStylesheet, type ParsedStylesheet, type RawDeclaration, type RegisteredProperty } from "./parse-css";
export { mergeRaw, resolveScope, type ResolvedScope, type ResolvedToken } from "./resolve";
export {
  LOCAL_SCOPES,
  normaliseScopeKey,
  RTL_EMITTED_PREFIXES,
  SHADOW_TOKEN_PATTERN,
  TOKEN_SCOPES,
  UnknownScopeError,
  UnsupportedValueError,
  type TokenScopeId,
} from "./scopes";
export {
  coerceValue,
  splitTopLevel,
  type BoxShadowLayer,
  type CurveSample,
  type DoubleUnit,
  type GenerationWarning,
  type TokenValue,
  type TokenValueKind,
} from "./values";
export {
  globalsCssPath,
  repoRoot,
  DART_OUTPUT_RELATIVE,
  GLOBALS_CSS_RELATIVE,
  JSON_OUTPUT_RELATIVE,
  TS_OUTPUT_RELATIVE,
} from "./paths";
export { generate, type GenerateResult } from "./generate";
