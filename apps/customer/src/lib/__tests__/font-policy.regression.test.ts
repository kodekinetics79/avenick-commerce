import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
const repoRoot = join(appRoot, "../../");

/**
 * The Content-Security-Policy must allow the fonts the product actually asks
 * for.
 *
 * It did not. `style-src 'self'` and `font-src 'self' data:` blocked every
 * typeface the design system declares — Inter, IBM Plex Sans Arabic, IBM Plex
 * Mono, Source Serif 4, Noto Kufi and Noto Naskh — and the storefront rendered
 * in system fallbacks for as long as that header has existed.
 *
 * It is a hard defect to see and an easy one to keep: a fallback face is still
 * a face, so every screenshot looks plausible, and the only evidence is one CSP
 * violation in a console nobody has open. It is caught here instead, by reading
 * what the CSS asks for and what the policy permits and requiring them to
 * agree.
 *
 * If the fonts are ever self-hosted — which is the better answer, since 'self'
 * needs no exception, costs no third-party round trip and sends no request to
 * Google from a Gulf visitor — this test goes green on its own: with no remote
 * @import there is nothing left to allow.
 */
describe("font policy", () => {
  const css = readFileSync(join(repoRoot, "packages/ui/src/globals.css"), "utf8");
  const layout = readFileSync(join(appRoot, "src/app/layout.tsx"), "utf8");
  // The SHARED policy, not the app's own config. The per-app next.config.mjs
  // carries a CSP for one route subtree; every other page — the whole
  // storefront, and both back offices — is served the header this file builds.
  // Checking the wrong one is how a fix gets applied to a policy nobody is
  // subject to and reported as done.
  const config = readFileSync(join(repoRoot, "packages/config/security-headers.mjs"), "utf8");

  const wantsRemoteFonts =
    css.includes("fonts.googleapis.com") || layout.includes("fonts.googleapis.com");

  it("permits the stylesheet origin whenever a remote font stylesheet is requested", () => {
    if (!wantsRemoteFonts) return;
    const styleSrc = /"style-src([^"]*)"/.exec(config)?.[1] ?? "";
    expect(
      styleSrc,
      "globals.css or layout.tsx loads a Google Fonts stylesheet that style-src blocks",
    ).toContain("https://fonts.googleapis.com");
  });

  it("permits the font-file origin, which is a DIFFERENT host from the stylesheet", () => {
    if (!wantsRemoteFonts) return;
    // Allowing only googleapis.com fetches the @font-face rules and then blocks
    // every file they point at — the most confusing half-fix available here,
    // because the stylesheet loads and no glyph changes.
    const fontSrc = /"font-src([^"]*)"/.exec(config)?.[1] ?? "";
    expect(fontSrc, "font files are served from fonts.gstatic.com, not googleapis.com").toContain(
      "https://fonts.gstatic.com",
    );
  });

  it("does not widen script-src or connect-src for fonts", () => {
    // Typography needs stylesheets and font files. Nothing else.
    const scriptSrc = /"script-src([^"]*)"/.exec(config)?.[1] ?? "";
    const connectSrc = /"connect-src([^"]*)"/.exec(config)?.[1] ?? "";
    expect(scriptSrc).not.toContain("fonts.g");
    expect(connectSrc).not.toContain("fonts.g");
  });
});
