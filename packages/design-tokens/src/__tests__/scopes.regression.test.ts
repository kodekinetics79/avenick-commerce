import { describe, expect, it } from "vitest";

import { extractTokens } from "../extract";
import { parseStylesheet } from "../parse-css";
import { LOCAL_SCOPES, TOKEN_SCOPES, UnknownScopeError, normaliseScopeKey } from "../scopes";
import { readGlobalsCss } from "./helpers";

const SOURCE = "packages/ui/src/globals.css";

/**
 * The drift alarm. Everything else in this package is arithmetic that can be
 * re-derived from the stylesheet; this is the part that notices when somebody
 * adds a token set the Flutter app was never told about.
 */
describe("unknown scopes are a build error", () => {
  it("throws, naming the selector, the property and the line", () => {
    const css = [
      ":root { --primary: 150 92% 26%; }",
      "",
      '[data-density="compact"] {',
      "  --row-h: 28px;",
      "}",
    ].join("\n");

    let thrown: unknown;
    try {
      parseStylesheet(css, SOURCE);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(UnknownScopeError);
    const error = thrown as UnknownScopeError;
    expect(error.scopeKey).toBe('[data-density="compact"]');
    expect(error.property).toBe("--row-h");
    expect(error.line).toBe(4);
    expect(error.message).toContain(`${SOURCE}:4`);
    expect(error.message).toContain("TOKEN_SCOPES");
    expect(error.message).toContain("LOCAL_SCOPES");
  });

  it("catches a new scope nested inside a media query too", () => {
    const css = [
      ":root { --primary: 150 92% 26%; }",
      "@media (prefers-contrast: more) {",
      "  :root { --border: 34 12% 40%; }",
      "}",
    ].join("\n");

    expect(() => parseStylesheet(css, SOURCE)).toThrowError(
      /@media \(prefers-contrast: more\) >> :root/,
    );
  });

  it("does not fire on a scope that is already classified as component-local", () => {
    const css = [
      ":root { --primary: 150 92% 26%; }",
      '.u-commit[data-tone="danger"] { --commit: var(--danger); }',
    ].join("\n");

    const parsed = parseStylesheet(css, SOURCE);
    expect(parsed.localScopesSeen).toEqual(['.u-commit[data-tone="danger"]']);
    expect(parsed.scopes.get("light")?.size).toBe(1);
  });

  it("normalises a grouped selector split across lines, so reformatting is not a false alarm", () => {
    expect(normaliseScopeKey(['[data-rim][data-rung="4"]::before,\n[data-rim][data-rung="5"]::before'])).toBe(
      '[data-rim][data-rung="4"]::before, [data-rim][data-rung="5"]::before',
    );
  });
});

describe("the registry matches the stylesheet as it stands today", () => {
  const css = readGlobalsCss();

  it("parses the real file without hitting an unclassified scope", () => {
    expect(() => parseStylesheet(css, SOURCE)).not.toThrow();
  });

  it("has no dead entries in LOCAL_SCOPES", () => {
    // A stale allow-list entry is a scope that could quietly come back without
    // anyone noticing, so an unused one is a defect rather than harmless slack.
    const seen = new Set(parseStylesheet(css, SOURCE).localScopesSeen);
    const dead = [...LOCAL_SCOPES.keys()].filter((key) => !seen.has(key));
    expect(dead).toEqual([]);
  });

  it("finds every token scope the registry claims exists", () => {
    const extraction = extractTokens(css, SOURCE);
    const populated = new Set(
      (
        [
          ["light", extraction.light],
          ["dark", extraction.dark],
          ["portalSeller", extraction.portalSeller],
          ["portalAdmin", extraction.portalAdmin],
          ["reducedMotion", extraction.reducedMotion],
          ["rtl", extraction.rtl],
        ] as const
      )
        .filter(([, set]) => Object.keys(set).length > 0)
        .map(([id]) => id),
    );
    for (const spec of TOKEN_SCOPES.values()) {
      expect(populated.has(spec.id), `${spec.id} produced no tokens`).toBe(true);
    }
  });

  it("verifies the dark selector is a class, not a media query or a data attribute", () => {
    expect(TOKEN_SCOPES.get(".dark")?.id).toBe("dark");
    expect(css).toMatch(/^\.dark \{/m);
    expect(css).not.toMatch(/@media \(prefers-color-scheme/);
  });
});

describe("posture and direction deltas", () => {
  const extraction = extractTokens(readGlobalsCss(), SOURCE);

  it("captures both portal postures without shipping them to the customer theme", () => {
    // Seller and admin tighten the same dials; the mobile app is the customer
    // posture, so these are captured for tooling and deliberately not emitted.
    expect(extraction.portalSeller["--radius"]?.value).toEqual({ kind: "double", value: 10, unit: "px" });
    expect(extraction.portalAdmin["--radius"]?.value).toEqual({ kind: "double", value: 8, unit: "px" });
    expect(extraction.light["--radius"]?.value).toEqual({ kind: "double", value: 14, unit: "px" });

    // The hero rung is made structurally unavailable outside the storefront by
    // aliasing it onto h1 — which only shows up if var() is resolved per scope.
    expect(extraction.portalSeller["--fs-hero"]?.value).toEqual(extraction.light["--fs-h1"]?.value);
  });

  it("emits only the RTL font override, and records every other RTL delta as an omission", () => {
    expect(Object.keys(extraction.rtl)).toEqual(["--font-provenance"]);
    expect(extraction.rtl["--font-provenance"]?.value).toEqual({
      kind: "string",
      value: "Noto Naskh Arabic",
      role: "fontFamily",
    });

    const omitted = extraction.warnings.filter((w) => w.kind === "rtl-delta-not-emitted").map((w) => w.property);
    expect(omitted).toContain("--dir");
    expect(omitted).toContain("--fs-hero");
    expect(omitted).toContain("--tr-h1");
    expect(omitted).not.toContain("--font-provenance");
  });

  it("captures the reduced-motion overrides, including --key-travel which :root never declares", () => {
    expect(extraction.reducedMotion["--motion-scale"]?.value).toEqual({ kind: "double", value: 0, unit: "none" });
    // --key-travel exists ONLY here; everywhere else it is read through
    // `var(--key-travel, var(--key-depth))`. A token that is declared in exactly
    // one scope is the easiest kind to lose, so it is pinned.
    expect(extraction.reducedMotion["--key-travel"]?.value).toEqual({ kind: "double", value: 0, unit: "px" });
    expect(extraction.light["--key-travel"]).toBeUndefined();
  });

  it("evaluates the motion calc() rather than passing it through", () => {
    // --t-panel is calc(var(--dur-3) * var(--motion-scale)) — the multiplication
    // that makes the whole posture and reduced-motion system work.
    expect(extraction.light["--t-panel"]?.value).toEqual({ kind: "duration", milliseconds: 220 });
    expect(extraction.light["--t-press"]?.value).toEqual({ kind: "duration", milliseconds: 90 });
  });
});
