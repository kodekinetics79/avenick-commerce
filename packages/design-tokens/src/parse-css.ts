/**
 * postcss walk → raw, unresolved declarations grouped by scope.
 *
 * This is postcss rather than a regex because globals.css has every shape a
 * regex quietly gets wrong: three `@property` at-rules whose NAME is a custom
 * property but whose body is not one, a `url("data:image/svg+xml,…")` grain
 * texture full of commas, parens and semicolons inside a quoted string, a
 * `linear()` easing spanning five physical lines, `@keyframes` that assign
 * custom properties, a `@media (prefers-reduced-motion: reduce)` block that
 * re-declares `:root`, and grouped selectors split across newlines. A regex
 * would not have failed on those; it would have half-matched them.
 */

import postcss, { type AtRule, type ChildNode, type Container, type Declaration, type Rule } from "postcss";

import { LOCAL_SCOPES, normaliseScopeKey, TOKEN_SCOPES, UnknownScopeError, type TokenScopeId } from "./scopes";

export interface RawDeclaration {
  readonly property: string;
  readonly value: string;
  readonly line: number;
}

/** A `@property` registration — CSS's own type annotation, kept as metadata. */
export interface RegisteredProperty {
  readonly property: string;
  readonly syntax: string;
  readonly initialValue: string;
  readonly inherits: boolean;
  readonly line: number;
}

export interface ParsedStylesheet {
  /** Scope id → property name → declaration. Insertion-ordered as the file is. */
  readonly scopes: ReadonlyMap<TokenScopeId, Map<string, RawDeclaration>>;
  readonly registeredProperties: readonly RegisteredProperty[];
  /** Local scopes actually seen, so the registry can be audited against reality. */
  readonly localScopesSeen: readonly string[];
}

export function parseStylesheet(css: string, sourceFile: string): ParsedStylesheet {
  const root = postcss.parse(css, { from: sourceFile });

  const scopes = new Map<TokenScopeId, Map<string, RawDeclaration>>();
  const registeredProperties: RegisteredProperty[] = [];
  const localScopesSeen = new Set<string>();

  root.walkAtRules("property", (atRule) => {
    registeredProperties.push(readRegisteredProperty(atRule));
  });

  root.walkDecls((decl) => {
    if (!decl.prop.startsWith("--")) return;
    const parent = decl.parent;
    if (!parent || parent.type === "root") return;
    // @property bodies declare `syntax`/`initial-value`, never a `--*` prop, so
    // they never reach here; the guard is belt-and-braces against a future shape.
    if (parent.type === "atrule" && (parent as AtRule).name === "property") return;

    const scopeKey = normaliseScopeKey(scopeChain(parent as Container<ChildNode>));
    const line = decl.source?.start?.line ?? 0;

    const local = LOCAL_SCOPES.get(scopeKey);
    if (local !== undefined) {
      localScopesSeen.add(scopeKey);
      return;
    }

    const tokenScope = TOKEN_SCOPES.get(scopeKey);
    if (tokenScope === undefined) {
      throw new UnknownScopeError(scopeKey, decl.prop, sourceFile, line);
    }

    let bucket = scopes.get(tokenScope.id);
    if (!bucket) {
      bucket = new Map<string, RawDeclaration>();
      scopes.set(tokenScope.id, bucket);
    }
    // Last declaration wins, exactly as the cascade would resolve it.
    bucket.set(decl.prop, { property: decl.prop, value: normaliseValue(decl), line });
  });

  return { scopes, registeredProperties, localScopesSeen: [...localScopesSeen] };
}

/**
 * Custom properties keep their value verbatim, which for this stylesheet means
 * two things worth handling: an inline comment can land inside the value, and
 * --ease-spring's `linear()` is five physical lines long. Strip the first,
 * collapse the second.
 */
function normaliseValue(decl: Declaration): string {
  return decl.value.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
}

function scopeChain(node: Container<ChildNode>): string[] {
  const parts: string[] = [];
  let current: Container<ChildNode> | undefined = node;
  while (current && current.type !== "root") {
    if (current.type === "rule") parts.unshift((current as Rule).selector);
    else if (current.type === "atrule") {
      const atRule = current as AtRule;
      parts.unshift(`@${atRule.name}${atRule.params ? ` ${atRule.params}` : ""}`);
    }
    current = current.parent as Container<ChildNode> | undefined;
  }
  return parts;
}

function readRegisteredProperty(atRule: AtRule): RegisteredProperty {
  const fields = new Map<string, string>();
  atRule.walkDecls((decl) => {
    fields.set(decl.prop, decl.value.trim());
  });
  return {
    property: atRule.params.trim(),
    syntax: (fields.get("syntax") ?? "").replace(/^["']|["']$/g, ""),
    initialValue: fields.get("initial-value") ?? "",
    inherits: fields.get("inherits") === "true",
    line: atRule.source?.start?.line ?? 0,
  };
}
