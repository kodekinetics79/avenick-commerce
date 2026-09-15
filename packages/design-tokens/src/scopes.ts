/**
 * The scope registry — the drift alarm.
 *
 * `packages/ui/src/globals.css` is the single source of truth for the design
 * system, and mobile is a THIRD consumer of it that cannot be reviewed by
 * looking at a browser. So the failure mode this file exists to prevent is not a
 * wrong value; it is a NEW value that mobile silently never hears about.
 *
 * Every rule in the stylesheet that declares a `--*` custom property must be
 * classified here, as either:
 *
 *   • a TOKEN SCOPE   — a document-level set that mobile extracts, or
 *   • a LOCAL SCOPE   — a component-scoped property that is a private
 *                       implementation detail of a CSS rule and has no
 *                       meaning outside the subtree it is declared on.
 *
 * Anything else is a hard build error. That is deliberate and it is the whole
 * point: when somebody adds `[data-density="compact"] { --row-h: 28px }` to
 * globals.css, the mobile build breaks and a human decides which of the two
 * lists it belongs in, instead of the Flutter app quietly shipping last
 * quarter's density.
 */

/** The buckets the extractor produces. */
export type TokenScopeId =
  | "light"
  | "dark"
  | "portalSeller"
  | "portalAdmin"
  | "rtl"
  | "reducedMotion";

export interface TokenScopeSpec {
  readonly id: TokenScopeId;
  readonly why: string;
}

/**
 * Document-level scopes, keyed by their NORMALISED scope chain (see
 * {@link normaliseScopeKey}).
 *
 * The dark selector was verified against the file rather than assumed: the
 * system uses a plain `.dark` class on the root element, NOT
 * `@media (prefers-color-scheme: dark)` and not `[data-theme="dark"]`.
 */
export const TOKEN_SCOPES: ReadonlyMap<string, TokenScopeSpec> = new Map<string, TokenScopeSpec>([
  [":root", { id: "light", why: "tokens — light. The base set; every other scope is a delta on it." }],
  [".dark", { id: "dark", why: "tokens — dark. Merged over light; the elevation mechanism inverts here." }],
  [
    '[data-portal="seller"]',
    { id: "portalSeller", why: "portal posture — seller. Captured, but the mobile app is the customer posture." },
  ],
  [
    '[data-portal="admin"]',
    { id: "portalAdmin", why: "portal posture — admin. Captured, but the mobile app is the customer posture." },
  ],
  ['[dir="rtl"]', { id: "rtl", why: "RTL. Only the font-family overrides cross to mobile; see RTL_EMITTED_PREFIXES." }],
  [
    "@media (prefers-reduced-motion: reduce) >> :root",
    {
      id: "reducedMotion",
      why: "reduced-motion token overrides. Root-level, so it is a real token set, not a component detail.",
    },
  ],
]);

/**
 * Component-local scopes: properties that live and die inside one rule's own
 * subtree. Each entry carries the reason it is NOT a token, because "why is this
 * not on mobile?" is the question this list has to answer a year from now.
 */
export const LOCAL_SCOPES: ReadonlyMap<string, string> = new Map<string, string>([
  ['[data-rung="1"]', "--ring-offset-surface: which surface a focus ring is punched out of at this rung."],
  ['[data-rung="3"]', "--ring-offset-surface, as above."],
  ['[data-rung="4"]', "--ring-offset-surface, as above."],
  ['[data-rung="5"]', "--ring-offset-surface, as above."],
  ['[data-glass="true"]', "--ring-offset-surface on the glass material."],
  ['[data-glass="display"]', "--ring-offset-surface on the display-glass material."],
  [
    '[data-rim][data-rung="2"]::before',
    "--rim-shoulder-3 re-pointed at the rung-2 shoulder; the conic fresnel ring reads one name.",
  ],
  [
    '[data-rim][data-rung="4"]::before, [data-rim][data-rung="5"]::before',
    "--rim-shoulder-3 re-pointed at the rung-4 shoulder, same mechanism.",
  ],
  ["[data-save-data]", "--motion-scale zeroed under Save-Data; the mobile equivalent is a platform API, not a token."],
  [".u-commit", "--commit / --commit-soft: the commit badge's own tone slot."],
  ['.u-commit[data-tone="danger"]', "commit badge tone slot."],
  ['.u-commit[data-tone="warning"]', "commit badge tone slot."],
  ['.u-commit[data-commit="failed"]', "commit badge tone slot."],
  ['.u-layer-panel[data-side="end"]', "--slide: the panel's own inline-direction offset."],
  ['.u-layer-panel[data-side="start"]', "--slide, as above."],
  [".u-seal", "--seal-plate: the seal mark's plate colour."],
  ["@keyframes seal-turn >> to", "--seal-angle: an animated @property, not a design token."],
  [".u-chrome", "--glass-alpha at rest on the sticky bar."],
  ['.u-chrome[data-at-top="false"]', "--glass-alpha / --chrome-pad while scrolled."],
  ["@keyframes chrome-settle >> from", "scroll-timeline keyframe."],
  ["@keyframes chrome-settle >> to", "scroll-timeline keyframe."],
  [
    "@media (prefers-reduced-motion: reduce) >> .u-seal",
    "--seal-angle parked at its designed still state; a component detail, not a token.",
  ],
]);

/**
 * `[dir="rtl"]` redeclares a whole Arabic type ramp — sizes, leading, tracking
 * and one font family. Only the FAMILY crosses to Flutter: the size ramp is
 * chosen against the web's fluid clamps and a phone resolves those differently,
 * so shipping the web's Arabic px ladder to mobile would be worse than shipping
 * nothing. Everything not matched here is recorded in the extraction as a
 * deliberate, visible omission rather than dropped.
 */
export const RTL_EMITTED_PREFIXES: readonly string[] = ["--font-"];

/** Custom-property names whose `none` means "no shadow", not the keyword `none`. */
export const SHADOW_TOKEN_PATTERN = /^--elev-\d+$/;

/**
 * Collapses a postcss node chain into the stable key the two maps above are
 * keyed by. Multi-selector rules keep their commas (`a, b`) so that splitting a
 * grouped rule in the stylesheet is itself a change this registry notices.
 */
export function normaliseScopeKey(parts: readonly string[]): string {
  return parts.map((part) => part.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim()).join(" >> ");
}

/** Thrown when globals.css declares a custom property somewhere unclassified. */
export class UnknownScopeError extends Error {
  constructor(
    readonly scopeKey: string,
    readonly property: string,
    readonly sourceFile: string,
    readonly line: number,
  ) {
    super(
      [
        `Unrecognised custom-property scope in ${sourceFile}:${line}`,
        ``,
        `    ${scopeKey} { ${property}: … }`,
        ``,
        `packages/design-tokens refuses to generate rather than let a new scope drift`,
        `away from the mobile app unnoticed. Classify it in`,
        `packages/design-tokens/src/scopes.ts:`,
        ``,
        `  • TOKEN_SCOPES — if it is a document-level token set the Flutter theme`,
        `    should carry (a new posture, a new theme, a new direction).`,
        `  • LOCAL_SCOPES — if the property is private to that rule's own subtree`,
        `    (a component's internal slot, a keyframe, an animated @property),`,
        `    with a one-line reason.`,
      ].join("\n"),
    );
    this.name = "UnknownScopeError";
  }
}

/** Thrown when a value's syntax is not one this generator can turn into Dart. */
export class UnsupportedValueError extends Error {
  constructor(
    readonly property: string,
    readonly value: string,
    readonly sourceFile: string,
    readonly line: number,
    detail: string,
  ) {
    super(
      [
        `Cannot coerce ${property} at ${sourceFile}:${line}`,
        ``,
        `    ${property}: ${value};`,
        ``,
        `${detail}`,
        ``,
        `A token the generator cannot type is a token the Flutter app would receive`,
        `as a guess, so this fails the build instead. Teach the coercion in`,
        `packages/design-tokens/src/values.ts, or give the token a shape it already`,
        `understands.`,
      ].join("\n"),
    );
    this.name = "UnsupportedValueError";
  }
}
