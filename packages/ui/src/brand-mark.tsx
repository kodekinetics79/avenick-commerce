import * as React from "react";
import { cn } from "@avenick/utils";
import {
  MARK_APEX,
  MARK_FEET,
  MARK_INNER_CONTOUR,
  MARK_MONO,
  MARK_OUTER_CONTOUR,
  MARK_RULE,
  MARK_SLAB,
  MARK_SMALL_CUT_BELOW,
  MARK_SMALL_RULE,
  MARK_SMALL_SLAB,
  MARK_SMALL_VIEWBOX,
  MARK_VIEWBOX,
  isAvenick,
} from "./brand-mark-geometry";

/**
 * BrandMark — the platform's own mark, and the only thing permitted to draw it.
 *
 * This is a Server Component on purpose (see <Surface>): a page must never
 * become `"use client"` to show a logo. All of its shape comes from
 * ./brand-mark-geometry, which is also what the favicons, the apple-icons, the
 * OG images and the email header are built from, so there is exactly one
 * drawing of the mark in the repository.
 *
 * ── WHAT THIS REPLACES ─────────────────────────────────────────────────────
 * Eight independent reimplementations of "a letter in a box", in six different
 * geometries — h-8 rounded-nested, h-11 rounded-nested, h-12 rounded-lg, a bare
 * glyph with no plate at all, and a 32px inline-styled div in an email — spread
 * across the customer header, the customer footer, the admin rail, three seller
 * auth surfaces, the loading screen and the 404. Three of them had drifted far
 * enough to still be drawing the pre-doctrine indigo→violet gradient tile with a
 * blur-xl glow behind it, and those three had stopped calling platformName()
 * altogether: they said "A" no matter what the deployment was called.
 *
 * ── WHY IT TAKES `name` AND DOES NOT CALL platformName() ITSELF ────────────
 * @avenick/ui must not take a runtime dependency on the env resolver to draw a
 * shape, and a server component that reads process.env is a component that
 * cannot be tested without one. The caller passes the resolved name — which is
 * also what makes the refusal below testable in three lines.
 *
 * ── THE REFUSAL ────────────────────────────────────────────────────────────
 * NEXT_PUBLIC_PLATFORM_NAME is a documented, live override (DEPLOYMENT.md), and
 * this repository is named `manzil` because the brand has already been renamed
 * once. So the mark cannot be unconditional: an Avenick "A" standing next to a
 * wordmark that reads "Manzil" is a logo asserting a brand the deployment does
 * not have — a claim rendered as fact, which is LAW F's territory, and worse
 * than the plain letter it replaced precisely because it looks authoritative.
 *
 * Avenick gets the Avenick mark. Everyone else gets their own initial on the
 * plate that has always carried it. Both are true; only one is Avenick.
 */

export interface BrandMarkProps {
  /**
   * The resolved platform name — pass `platformName()`. Decides both the
   * accessible name and whether this deployment is entitled to the mark.
   */
  name: string;
  /**
   * Rendered size in CSS pixels. Below 40 the small cut ships instead of the
   * master: the master's optical events are sub-pixel there and a 0.5px stroke
   * antialiases to uniform grey, so they are deleted rather than scaled.
   */
  size?: number;
  /**
   * The entrance hop, on the mark that leads the page. The customer header takes
   * it; the footer's identical mark does not, because an entrance animation
   * below the fold is one nobody sees and a second hopping mark competes with
   * the first for the attention the first exists to get.
   */
  animated?: boolean;
  /**
   * One colour, one path, no lighting — for a context that cannot run a
   * stylesheet or must not carry brass.
   */
  mono?: boolean;
  className?: string;
}

/**
 * The lit master. Four optical events (§3.4), zero rotations (§9), symmetric
 * about x=32 so it is byte-identical in Arabic (LAW B).
 *
 * The gradients read the live tokens, so the mark inherits the portal's own dial
 * for free: --rim-shoulder-3 is .48 on customer, .38 on seller and .30 on admin,
 * and the mark quiets down in the back office without a prop.
 *
 * The ids are suffixed with React's useId because two marks on one page — the
 * header's and the footer's — would otherwise both resolve url(#mi) to whichever
 * <clipPath> the document happened to hold first.
 */
function EntryMaster({ uid }: { uid: string }) {
  const clip = `avk-i-${uid}`;
  const shoulder = `avk-s-${uid}`;
  const counter = `avk-c-${uid}`;
  const foot = `avk-f-${uid}`;
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={MARK_SLAB} />
        </clipPath>
        <linearGradient id={shoulder} gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="34">
          <stop className="u-brand__lit" />
          <stop offset="1" className="u-brand__lit0" />
        </linearGradient>
        <linearGradient id={counter} gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="44">
          <stop className="u-brand__dk" />
          <stop offset="1" className="u-brand__dk0" />
        </linearGradient>
        <radialGradient id={foot}>
          <stop className="u-brand__ct" />
          <stop offset="1" className="u-brand__ct0" />
        </radialGradient>
      </defs>

      {/* 4. CONTACT — where the feet meet the ground. Zero x-offset as a pair,
          which is how LAW B survives a shape that is not a rectangle. */}
      <g className="u-brand__lit-group">
        {MARK_FEET.map((f) => (
          <ellipse key={f.cx} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill={`url(#${foot})`} />
        ))}
      </g>

      {/* The slab. `currentColor`, so forced-colors gets a real silhouette. */}
      <path d={MARK_SLAB} fill="currentColor" />

      <g clipPath={`url(#${clip})`} className="u-brand__lit-group">
        {/* 1. HIGHLIGHT — the seam where the source hits the apex. */}
        <rect
          className="u-brand__apex"
          x={MARK_APEX.x}
          y={MARK_APEX.y}
          width={MARK_APEX.width}
          height={MARK_APEX.height}
        />
        {/* 2. FRESNEL SHOULDER — the highlight fading AROUND the perimeter.
            A vertical alpha ramp clipped to the path's own inside is the SVG
            translation of [data-rim]::before's masked conic, and it gets there
            without mask-composite, which Safari and Firefox disagree about. */}
        <path
          fill="none"
          stroke={`url(#${shoulder})`}
          strokeWidth="1.4"
          strokeLinejoin="round"
          d={MARK_OUTER_CONTOUR}
        />
        {/* 3. COUNTER-FRESNEL — the undersides, including the counter's overhang. */}
        <path
          fill="none"
          stroke={`url(#${counter})`}
          strokeWidth="1.4"
          strokeLinejoin="round"
          d={MARK_INNER_CONTOUR}
        />
        <rect className="u-brand__under" y="55.25" width="64" height=".75" />
      </g>

      {/* THE RULE — the system's one gesture, in the posture of an entrance. */}
      <rect
        className="u-brand__rule"
        x={MARK_RULE.x}
        y={MARK_RULE.y}
        width={MARK_RULE.width}
        height={MARK_RULE.height}
      />
      <rect
        className="u-brand__under u-brand__lit-group"
        x={MARK_RULE.x}
        y={MARK_RULE.y + MARK_RULE.height - 0.75}
        width={MARK_RULE.width}
        height=".75"
      />
    </>
  );
}

export function BrandMark({ name, size = 32, animated = false, mono = false, className }: BrandMarkProps) {
  const uid = React.useId().replace(/:/g, "");

  // A deployment that renamed itself is not Avenick and does not get Avenick's
  // mark. It keeps the plate the monogram has always had — the same keycap edge,
  // the same hop — carrying the initial it actually has.
  if (!isAvenick(name)) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          animated ? "u-mark" : "u-mark-flat",
          "grid place-items-center rounded-nested bg-ink-1 font-semibold text-ink-inv",
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
      >
        {name.trim().charAt(0).toUpperCase()}
      </span>
    );
  }

  if (mono) {
    return (
      <svg
        aria-hidden="true"
        viewBox={MARK_VIEWBOX}
        width={size}
        height={size}
        fill="currentColor"
        className={cn("u-brand", className)}
      >
        <path fillRule="evenodd" d={MARK_MONO} />
      </svg>
    );
  }

  const small = size < MARK_SMALL_CUT_BELOW;

  return (
    <svg
      aria-hidden="true"
      viewBox={small ? MARK_SMALL_VIEWBOX : MARK_VIEWBOX}
      width={size}
      height={size}
      className={cn("u-brand", animated && "u-brand--enter", className)}
    >
      {small ? (
        <>
          {/* The small cut: silhouette and one rule. Everything optical is gone
              rather than shrunk — see MARK_SMALL_SLAB for why. */}
          <path d={MARK_SMALL_SLAB} fill="currentColor" />
          <rect
            className="u-brand__rule"
            x={MARK_SMALL_RULE.x}
            y={MARK_SMALL_RULE.y}
            width={MARK_SMALL_RULE.width}
            height={MARK_SMALL_RULE.height}
          />
        </>
      ) : (
        <EntryMaster uid={uid} />
      )}
    </svg>
  );
}

/**
 * BrandLockup — the mark and the wordmark, set as one object.
 *
 * The wordmark is text rather than outlines: it has to be the configured name,
 * it has to be selectable, and it has to be the page's accessible name for the
 * home link. Outlining it would freeze "Avenick" into the geometry, which is the
 * same mistake as the fixed monogram one layer down.
 *
 * The mark carries aria-hidden and the LABEL carries the name, so a screen
 * reader hears the brand once rather than twice.
 */
export interface BrandLockupProps extends BrandMarkProps {
  /** Hide the wordmark below this Tailwind breakpoint (the header does, for the search field). */
  wordmarkFrom?: "sm" | "md" | "lg" | "always";
  wordmarkClassName?: string;
}

export function BrandLockup({
  name,
  size = 32,
  animated = false,
  mono = false,
  className,
  wordmarkFrom = "always",
  wordmarkClassName,
}: BrandLockupProps) {
  const hide =
    wordmarkFrom === "always"
      ? ""
      : wordmarkFrom === "sm"
        ? "hidden sm:inline"
        : wordmarkFrom === "md"
          ? "hidden md:inline"
          : "hidden lg:inline";
  return (
    <span className={cn("flex shrink-0 items-center gap-2.5", className)}>
      <BrandMark name={name} size={size} animated={animated} mono={mono} />
      <span className={cn("u-h3 text-ink-1", hide, wordmarkClassName)}>{name}</span>
    </span>
  );
}
