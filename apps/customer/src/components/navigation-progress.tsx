"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * The navigation hairline: a readout that a click on an internal link has been
 * taken and the next page is on its way.
 *
 * WHAT IT REPLACES. This file shipped with the first storefront commit and was
 * never taken through the design system. It drew a three-stop gradient bar with
 * an indigo neon glow (`shadow-[0_0_10px_rgba(99,102,241,0.7)…]`) on a green
 * brand, animated its `width` every 50ms, sat at z-[9999] above every dialog,
 * and laid a second full-viewport overlay over the page to dim it. Every one of
 * those is named somewhere in packages/ui/DESIGN_SYSTEM.md: a glow utility is
 * banned outright (§9), `width` is not on the list of things that may animate
 * (§8), and a sixth brass-coloured gesture with its own look is §10.13.
 *
 * WHAT IT IS NOW. The system's one gesture in another posture: the same 2px
 * brass rule as the active nav mark, the section marks and the reading
 * hairline, drawn with `scaleX` from the inline start. Its transform-origin is
 * the --origin-inline-start token, so it draws from the right in Arabic with no
 * branch here. It does not reuse `.u-scroll-progress`, and that is deliberate:
 * that class carries a scroll-driven animation, and globals.css hides every
 * copy of it but the one the header hosts. It sits on the `progress` z rung,
 * above the sticky header and below every layer, so a dialog is never painted
 * over.
 *
 * REDUCED MOTION. The creep is movement, so a visitor who asked for less of it
 * does not get one. The rule appears at its resting length and fades when the
 * route lands. The readout survives, and only the travel is gone. The media
 * query is read once, on mount, the way the header's disclosures read theirs.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedRef = React.useRef(false);
  const prevPathRef = React.useRef(pathname + searchParams.toString());

  React.useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    reducedRef.current = reduced;
    setReducedMotion(reduced);
  }, []);

  // Start the progress bar
  const start = React.useCallback(() => {
    setLoading(true);

    // Clear any existing timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (reducedRef.current) {
      setProgress(90);
      return;
    }

    setProgress(0);
    // Rapidly move to ~85% then slow down
    let p = 0;
    timerRef.current = setInterval(() => {
      p += Math.max(1, (90 - p) * 0.08);
      if (p >= 90) p = 90;
      setProgress(p);
    }, 50);
  }, []);

  // Finish the progress bar
  const finish = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(100);
    setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 300);
  }, []);

  // Detect route changes to stop the bar
  React.useEffect(() => {
    const current = pathname + searchParams.toString();
    if (prevPathRef.current !== current) {
      finish();
      prevPathRef.current = current;
    }
  }, [pathname, searchParams, finish]);

  // Intercept all <a> clicks on internal links
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip external links, hash-only links, mailto, tel, etc.
      if (
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey
      ) {
        return;
      }

      // Don't trigger if it's the same page
      const current = pathname + (searchParams.toString() ? "?" + searchParams.toString() : "");
      if (href === current || href === pathname) return;

      start();
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, searchParams, start]);

  if (!loading && progress === 0) return null;

  const done = progress === 100;

  return (
    <div
      aria-hidden="true"
      data-navigation-progress=""
      className="pointer-events-none fixed inset-x-0 top-0 z-progress h-[2px] bg-brass"
      style={{
        transform: `scaleX(${progress / 100})`,
        transformOrigin: "var(--origin-inline-start)",
        opacity: done ? 0 : 1,
        // Progress is linear (§8). The exit is the opacity alone, on the exit
        // curve, and it is over before the 300ms unmount below. Under reduced
        // motion there is no transform transition at all: the rule does not
        // travel, it is simply there and then gone.
        transition: reducedMotion
          ? "opacity var(--t-panel) var(--ease-exit)"
          : "transform 100ms linear, opacity var(--t-panel) var(--ease-exit)",
      }}
    />
  );
}
