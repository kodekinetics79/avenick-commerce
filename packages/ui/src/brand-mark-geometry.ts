/**
 * THE ENTRY — the Avenick mark, as geometry.
 *
 * This module is the ONE source of the mark's shape. It has no JSX, no React
 * import and no `"use client"` directive, because it is consumed from three
 * places that cannot all be React:
 *
 *   1. <BrandMark> (brand-mark.tsx)              — every in-app surface
 *   2. brandMarkDocument() below                 — favicon, apple-icon, OG, email
 *   3. the regression test                       — asserts 1 and 2 agree
 *
 * LAW 9 is why the split exists at all: Next replaces every export of a
 * `"use client"` module with a client reference in the server graph, so a plain
 * function exported beside a client component survives development and fails the
 * PRODUCTION build with a minified TypeError naming no file. A string-returning
 * helper called from `icon.tsx` (a server file) must therefore live in a module
 * with no directive. It does.
 *
 * WHY A MODULE AND NOT FOUR .svg FILES. The mark is rendered by the header, the
 * footer, six auth and shell surfaces, three favicons, three apple-icons, three
 * OG images and one email header. Four checked-in copies of the path data drift
 * the moment one of them is corrected — which is the failure the brands page
 * already shipped once, in the other direction, when a logoUrl existed and the
 * page drew a letter instead. One export, many consumers, and
 * `__tests__/brand-mark.regression.test.ts` fails if a caller stops matching.
 *
 * ── THE SHAPE ──────────────────────────────────────────────────────────────
 * An A whose crossbar is the brass rule. That is the whole idea, and it is the
 * reason this is a mark rather than a letter with the house gesture stuck on
 * it: take the rule off DIRECTION 2 or 3 and a letter remains; take it off this
 * one and there is a chevron. §10.13 says the system's advantage is that it has
 * ONE gesture — the brass rule drawn from the inline start — and that a new
 * agent inventing a sixth is how a system stops reading as designed. So the mark
 * does not invent one. It is the active-nav rule, the ladder's band and the
 * certificate's top edge, in the posture of an entrance.
 *
 * It also has NO TIMING, which is the other half of not being a sixth gesture:
 * it is that rule at rest, the state after scaleX(1), frozen.
 *
 * ── WHY IT IS SAFE IN ARABIC, FOR FREE ─────────────────────────────────────
 * Every edge sits on a 3/8 slope and the whole mark is symmetric about x=32.
 * It is therefore byte-identical under [dir="rtl"]: no mirroring, no `--dir`
 * custom property, no second file. LAW B ("one light, overhead, zero x-offset")
 * is not decoration here — it is the reason there is one file instead of two.
 *
 * ── THE DEPTH IS §3.4, AT ZERO DEGREES ─────────────────────────────────────
 * §9 bans 3D tilt on any card in any portal; the sentence immediately after it
 * is "depth arrives as Z-position, never as rotation." All four optical events
 * of §3.4 are drawn here and not one of them is a rotation:
 *
 *   1 HIGHLIGHT       the seam where the source hits the apex
 *   2 FRESNEL         the highlight fading AROUND the outer perimeter
 *   3 COUNTER-FRESNEL the undersides — the feet, and the counter's overhang
 *   4 CONTACT         where the feet meet the ground
 *
 * Two depth intervals: the rule stands proud of the slab, the slab stands on the
 * ground. Every gradient varies ALPHA ONLY on a single hue, so no gradient here
 * crosses a hue and §3.11's `in oklab` has nothing to fix — and none of them is
 * an ambient fill, so <AmbientField> remains the one permitted ambient gradient.
 */

/** The 64-unit design grid every path below is drawn on. */
export const MARK_VIEWBOX = "0 0 64 64";

/**
 * The silhouette: the A with the rule cut out of it, as one path.
 * Shared by the lit master and the clip that keeps the optical events inside it.
 */
export const MARK_SLAB = "M24.5 8h15l18 48h-12L32 20 18.5 56H6.5Z";

/** The apex highlight — part 1. A 0.75-unit seam, not a stroke. */
export const MARK_APEX = { x: 24, y: 8, width: 16, height: 0.75 } as const;

/** Part 2 rides the OUTER contour; part 3 rides the counter's inner contour. */
export const MARK_OUTER_CONTOUR = "M6.5 56 24.5 8h15l18 48";
export const MARK_INNER_CONTOUR = "m18.5 56 13.5-36 13.5 36";

/**
 * THE RULE. 5 units on a 48-unit letter, let into both legs.
 *
 * Brass arithmetic, because §3.10 caps brass at 2% of viewport pixels and grants
 * it exactly three uses: 22 × 5 of a 64 × 64 box is 2.7% OF THE MARK, which at a
 * 32px header mark is ~27 device pixels in a ~1.3M pixel viewport — four orders
 * of magnitude inside the budget. It does not need a fourth permitted use
 * either: marking the entry is the active-indicator rule at a different scale.
 */
export const MARK_RULE = { x: 21, y: 35, width: 22, height: 5 } as const;

/** The two feet. Zero x-offset AS A PAIR, which is how LAW B survives a glyph. */
export const MARK_FEET = [
  { cx: 12.5, cy: 56.6, rx: 9.5, ry: 3.2 },
  { cx: 51.5, cy: 56.6, rx: 9.5, ry: 3.2 },
] as const;

/**
 * THE 16px CUT — a different drawing of the same letter, not the master shrunk.
 *
 * All four optical events are DELETED rather than scaled. A 0.75-unit seam at
 * 16px is 0.19 device pixels, which is not a seam, it is a smear; and a 0.5px
 * stroke antialiases to uniform grey, so "just make it thinner" produces a
 * lighter blur rather than a finer line. What survives a favicon is a silhouette
 * and one rule, so that is exactly what is left.
 *
 * Every horizontal and vertical edge is an integer on a 16-unit box, so at 16,
 * 32 and 64 CSS pixels each lands on a device pixel with nothing antialiased.
 *
 * And it is drawn WIDER than a true scale of the master — 14:12 against 51:48.
 * That is the ordinary caption-cut correction: at 12px of letter height the
 * master's aperture closes to ~6px and a closed aperture reads as a chevron
 * rather than an A. Widening opens it to 8px. Same letter, cut for the size,
 * which is what an optical-size axis does for the type sitting beside it.
 */
export const MARK_SMALL_VIEWBOX = "0 0 16 16";
export const MARK_SMALL_SLAB = "M6 2h4l5 12h-3L8 4.4 4 14H1Z";
export const MARK_SMALL_RULE = { x: 4, y: 9, width: 8, height: 1 } as const;

/**
 * Below this many CSS pixels the master's optical events stop being events.
 * <BrandMark> switches cuts here rather than asking every caller to know.
 */
export const MARK_SMALL_CUT_BELOW = 40;

/**
 * THE MONOCHROME CUT — one path, one fill rule, no rule of its own.
 *
 * Emboss, foil, laser, stitch, single-colour press, and any renderer that will
 * not run a stylesheet. The rule is no longer brass, so it has to merge into the
 * letterform — but the silhouette must NOT change with the ink, so the crossbar
 * survives as the counter's flat bottom via `fill-rule="evenodd"`.
 */
export const MARK_MONO =
  "M24.5 8h15l18 48h-12l-6-16h-15l-6 16H6.5ZM32 20l5.625 15h-11.25Z";

/**
 * The measured light-model values from globals.css, for STANDALONE renders only.
 *
 * When the mark is inlined into a page it reads the live tokens and inherits the
 * portal's own dial — `--rim-shoulder-3` is .48 on customer, .38 on seller and
 * .30 on admin, so the mark quiets down in the back office for free. When it is
 * a favicon, an <img> or an email attachment there is no stylesheet to read, so
 * these ride along as var() fallbacks and `prefers-color-scheme` is the only
 * theme signal available.
 *
 * These are COPIES of globals.css values and the regression test asserts they
 * still match. A copy nobody checks is how a mark ends up a different colour in
 * the tab than it is on the page.
 */
export const MARK_FALLBACK_LIGHT = {
  ink: "224 22% 11%",
  rim: "0 0% 100%",
  rimShoulder3: ".48",
  fresnelUnder: "226 32% 12%",
  fresnelAlpha: ".055",
  contact: "226 40% 10%",
  contactAlpha: ".05",
  shadow: "226 32% 12%",
  brass: "36 56% 42%",
} as const;

export const MARK_FALLBACK_DARK = {
  ink: "40 14% 94%",
  rimShoulder3: ".07",
  fresnelUnder: "0 0% 0%",
  fresnelAlpha: ".34",
  contact: "232 60% 1%",
  contactAlpha: ".45",
  shadow: "232 60% 2%",
  brass: "38 62% 60%",
} as const;

/**
 * The one permitted brand literal, mirrored from
 * packages/utils/src/portal-config.ts. It is duplicated rather than imported
 * because @avenick/ui must not take a runtime dependency on the env resolver to
 * draw a shape; the regression test asserts the two strings are identical, so a
 * rename in portal-config fails here loudly instead of silently un-branding the
 * product.
 */
export const AVENICK = "Avenick";

/**
 * Does this deployment get the Avenick mark, or its own initial?
 *
 * `platformName()` reads NEXT_PUBLIC_PLATFORM_NAME and falls back to "Avenick";
 * DEPLOYMENT.md documents the override, portal-config's own test asserts it
 * resolves "  Manzil  " to "Manzil", and this repository is called `manzil`
 * because the brand HAS already been renamed once. So the override is live, not
 * theoretical.
 *
 * A fixed A drawn beside a wordmark that says something else is a logo asserting
 * a brand the deployment does not have — a claim rendered as fact, which is
 * exactly what LAW F exists to stop, and worse than the plain letter it replaced
 * because it is confident. So the mark REFUSES rather than guesses: Avenick gets
 * the Avenick mark, and anyone else gets their own initial on the same lit
 * plate. Both are true; only one of them is Avenick.
 */
export function isAvenick(name: string): boolean {
  return name.trim() === AVENICK;
}

/**
 * The mark as a standalone SVG document — favicon, apple-icon, OG image, email.
 *
 * Returned as a string rather than a component because every one of those
 * consumers needs bytes, not an element: `icon.tsx` returns a Response, and the
 * email path builds an HTML string. This is the function LAW 9 would have broken
 * if it had lived next to the component.
 *
 * `size` picks the cut, not just the width: below MARK_SMALL_CUT_BELOW the 16px
 * drawing ships instead of a shrunk master, for the reasons on MARK_SMALL_SLAB.
 */
export interface BrandMarkDocumentOptions {
  size: number;
  /** Draw the plate behind the mark (app icons need a ground; favicons do not). */
  plate?: boolean;
  /** Accessible name. Pass the resolved platform name. */
  title: string;
  /**
   * FLATTEN to literal colours for one theme, emitting no <style>, no custom
   * properties and no media query.
   *
   * Required by every rasteriser. Next's icon.tsx / opengraph-image.tsx render
   * through Satori, which composites SVG via resvg: gradients, clipPaths and
   * strokes all work, and `var()` and `@media` do not — a token-driven document
   * hands it an empty box with no error. Email clients are the same story for
   * different reasons.
   *
   * Omit it for a document that will be inlined into a live page, where reading
   * the real tokens is the entire point.
   */
  theme?: "light" | "dark";
}

export function brandMarkDocument(options: BrandMarkDocumentOptions): string {
  const { size, plate = false, title, theme } = options;
  const small = size < MARK_SMALL_CUT_BELOW;
  const L = MARK_FALLBACK_LIGHT;
  const D = MARK_FALLBACK_DARK;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // NOTE: no `--` may appear inside an XML comment, so these documents carry no
  // comments at all. An SVG that does not parse as XML is not a favicon.

  if (theme) {
    // ── FLATTENED ──────────────────────────────────────────────────────────
    const t = theme === "dark" ? D : L;
    const rim = theme === "dark" ? L.rim : L.rim; // white in both themes
    const ink = `hsl(${t.ink})`;
    const brass = `hsl(${t.brass})`;
    const ground = theme === "dark" ? "hsl(224 24% 8%)" : "hsl(40 20% 98%)";

    if (small) {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_SMALL_VIEWBOX}" ` +
        `width="${size}" height="${size}" role="img">` +
        `<title>${esc(title)}</title>` +
        (plate ? `<rect width="16" height="16" rx="3.5" fill="${ground}"/>` : "") +
        `<path d="${MARK_SMALL_SLAB}" fill="${ink}"/>` +
        `<rect x="${MARK_SMALL_RULE.x}" y="${MARK_SMALL_RULE.y}" ` +
        `width="${MARK_SMALL_RULE.width}" height="${MARK_SMALL_RULE.height}" fill="${brass}"/>` +
        `</svg>`
      );
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" ` +
      `width="${size}" height="${size}" role="img">` +
      `<title>${esc(title)}</title>` +
      `<defs>` +
      `<clipPath id="mi"><path d="${MARK_SLAB}"/></clipPath>` +
      `<linearGradient id="ms" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="34">` +
      `<stop stop-color="hsl(${rim})" stop-opacity="${t.rimShoulder3}"/>` +
      `<stop offset="1" stop-color="hsl(${rim})" stop-opacity="0"/></linearGradient>` +
      `<linearGradient id="mc" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="44">` +
      `<stop stop-color="hsl(${t.fresnelUnder})" stop-opacity="${t.fresnelAlpha}"/>` +
      `<stop offset="1" stop-color="hsl(${t.fresnelUnder})" stop-opacity="0"/></linearGradient>` +
      `<radialGradient id="mf">` +
      `<stop stop-color="hsl(${t.contact})" stop-opacity="${t.contactAlpha}"/>` +
      `<stop offset="1" stop-color="hsl(${t.contact})" stop-opacity="0"/></radialGradient>` +
      `</defs>` +
      (plate ? `<rect width="64" height="64" rx="14" fill="${ground}"/>` : "") +
      // A plate needs an optical margin the bare mark does not: an app icon is
      // composited against a wallpaper and then corner-masked by the OS, so a
      // mark drawn to the plate's own edge reads as cropped rather than placed.
      // 0.74 centred puts the feet on the same margin the apex has.
      (plate ? `<g transform="translate(8.32 8.32) scale(0.74)">` : "") +
      MARK_FEET.map(
        (f) => `<ellipse cx="${f.cx}" cy="${f.cy}" rx="${f.rx}" ry="${f.ry}" fill="url(#mf)"/>`,
      ).join("") +
      `<path d="${MARK_SLAB}" fill="${ink}"/>` +
      `<g clip-path="url(#mi)">` +
      `<rect x="${MARK_APEX.x}" y="${MARK_APEX.y}" width="${MARK_APEX.width}" ` +
      `height="${MARK_APEX.height}" fill="hsl(${rim})" fill-opacity="0.88"/>` +
      `<path fill="none" stroke="url(#ms)" stroke-width="1.4" stroke-linejoin="round" d="${MARK_OUTER_CONTOUR}"/>` +
      `<path fill="none" stroke="url(#mc)" stroke-width="1.4" stroke-linejoin="round" d="${MARK_INNER_CONTOUR}"/>` +
      `<rect y="55.25" width="64" height=".75" fill="hsl(${t.fresnelUnder})" fill-opacity="${t.fresnelAlpha}"/>` +
      `</g>` +
      `<rect x="${MARK_RULE.x}" y="${MARK_RULE.y}" width="${MARK_RULE.width}" ` +
      `height="${MARK_RULE.height}" fill="${brass}"/>` +
      `<rect x="${MARK_RULE.x}" y="${MARK_RULE.y + MARK_RULE.height - 0.75}" ` +
      `width="${MARK_RULE.width}" height=".75" fill="hsl(${t.fresnelUnder})" ` +
      `fill-opacity="${t.fresnelAlpha}"/>` +
      (plate ? `</g>` : "") +
      `</svg>`
    );
  }

  // ── TOKEN-DRIVEN (inlined into a live page, or a standalone render that can
  // at least run a stylesheet: prefers-color-scheme is then the only signal) ──
  const vars =
    `--_i:${L.ink};--_rm:${L.rim};--_s:${L.rimShoulder3};--_fu:${L.fresnelUnder};` +
    `--_fa:${L.fresnelAlpha};--_c:${L.contact};--_ca:${L.contactAlpha};--_b:${L.brass}`;
  const darkVars =
    `--_i:${D.ink};--_s:${D.rimShoulder3};--_fu:${D.fresnelUnder};` +
    `--_fa:${D.fresnelAlpha};--_c:${D.contact};--_ca:${D.contactAlpha};--_b:${D.brass}`;

  if (small) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_SMALL_VIEWBOX}" ` +
      `width="${size}" height="${size}" role="img" class="m">` +
      `<title>${esc(title)}</title>` +
      `<style>.m{${vars}}@media(prefers-color-scheme:dark){.m{${darkVars}}}` +
      `.m .k{fill:hsl(var(--ink-1,var(--_i)))}.m .b{fill:hsl(var(--brass,var(--_b)))}</style>` +
      `<path class="k" d="${MARK_SMALL_SLAB}"/>` +
      `<rect class="b" x="${MARK_SMALL_RULE.x}" y="${MARK_SMALL_RULE.y}" ` +
      `width="${MARK_SMALL_RULE.width}" height="${MARK_SMALL_RULE.height}"/>` +
      `</svg>`
    );
  }

  const plateRect = plate
    ? `<rect width="64" height="64" rx="14" fill="hsl(var(--surface-2,0 0% 100%))"/>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" ` +
    `width="${size}" height="${size}" role="img" class="m">` +
    `<title>${esc(title)}</title>` +
    `<style>.m{${vars}}@media(prefers-color-scheme:dark){.m{${darkVars}}}` +
    `.m .k{fill:hsl(var(--ink-1,var(--_i)))}` +
    `.m .b{fill:hsl(var(--brass,var(--_b)))}` +
    `.m .h{fill:hsl(var(--rim,var(--_rm))/var(--rim-3,.88))}` +
    `.m .u{fill:hsl(var(--fresnel-under,var(--_fu))/var(--fresnel-alpha,var(--_fa)))}` +
    `.m .lit{stop-color:hsl(var(--rim,var(--_rm)));stop-opacity:var(--rim-shoulder-3,var(--_s))}` +
    `.m .lit0{stop-color:hsl(var(--rim,var(--_rm)));stop-opacity:0}` +
    `.m .dk{stop-color:hsl(var(--fresnel-under,var(--_fu)));stop-opacity:var(--fresnel-alpha,var(--_fa))}` +
    `.m .dk0{stop-color:hsl(var(--fresnel-under,var(--_fu)));stop-opacity:0}` +
    `.m .ct{stop-color:hsl(var(--contact,var(--_c)));stop-opacity:var(--contact-alpha,var(--_ca))}` +
    `.m .ct0{stop-color:hsl(var(--contact,var(--_c)));stop-opacity:0}</style>` +
    `<defs>` +
    `<clipPath id="mi"><path d="${MARK_SLAB}"/></clipPath>` +
    `<linearGradient id="ms" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="34">` +
    `<stop class="lit"/><stop offset="1" class="lit0"/></linearGradient>` +
    `<linearGradient id="mc" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="44">` +
    `<stop class="dk"/><stop offset="1" class="dk0"/></linearGradient>` +
    `<radialGradient id="mf"><stop class="ct"/><stop offset="1" class="ct0"/></radialGradient>` +
    `</defs>` +
    plateRect +
    MARK_FEET.map(
      (f) =>
        `<ellipse cx="${f.cx}" cy="${f.cy}" rx="${f.rx}" ry="${f.ry}" fill="url(#mf)"/>`,
    ).join("") +
    `<path class="k" d="${MARK_SLAB}"/>` +
    `<g clip-path="url(#mi)">` +
    `<rect class="h" x="${MARK_APEX.x}" y="${MARK_APEX.y}" ` +
    `width="${MARK_APEX.width}" height="${MARK_APEX.height}"/>` +
    `<path fill="none" stroke="url(#ms)" stroke-width="1.4" stroke-linejoin="round" ` +
    `d="${MARK_OUTER_CONTOUR}"/>` +
    `<path fill="none" stroke="url(#mc)" stroke-width="1.4" stroke-linejoin="round" ` +
    `d="${MARK_INNER_CONTOUR}"/>` +
    `<rect class="u" y="55.25" width="64" height=".75"/>` +
    `</g>` +
    `<rect class="b" x="${MARK_RULE.x}" y="${MARK_RULE.y}" ` +
    `width="${MARK_RULE.width}" height="${MARK_RULE.height}"/>` +
    `<rect class="u" x="${MARK_RULE.x}" y="${MARK_RULE.y + MARK_RULE.height - 0.75}" ` +
    `width="${MARK_RULE.width}" height=".75"/>` +
    `</svg>`
  );
}
