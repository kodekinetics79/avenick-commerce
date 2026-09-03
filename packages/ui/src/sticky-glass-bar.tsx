"use client";

import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * StickyGlassBar — chrome that SETTLES rather than snapping.
 *
 * Round one crossed between two states at a threshold. Across the first 96px of
 * scroll the bar now continuously gains weight: its glass fill deepens from .55
 * to .92, its padding tightens from 18px to 10px, and a cast shadow fades up
 * beneath it. It feels engineered rather than toggled, and it costs ZERO
 * JavaScript and zero scroll listeners — it is a CSS scroll-driven animation
 * running on the compositor.
 *
 * Three implementation rules that are not negotiable, all enforced in globals.css:
 *
 *   NEVER animate the backdrop-filter blur RADIUS. Recompositing a blur every
 *   frame is the classic mid-range-Android killer. The blur is static; only the
 *   alpha behind it moves.
 *
 *   The shadow arrives by cross-fading the opacity of an ::after that statically
 *   carries the elevation rung. Animating box-shadow repaints the whole element.
 *
 *   The start alpha is .55, not 0. Nav text has to clear 4.5:1 against the WORST
 *   frame of the animation, not the resting state.
 *
 * THE FALLBACK. The IntersectionObserver sentinel survives, because scroll
 * timelines are roughly 84–90% support and the other 10% still deserve a bar
 * that responds. It now only flips a data attribute, which CSS uses when there
 * is no timeline to override it. With JavaScript off, before hydration, or if
 * the observer never fires, the bar is simply always glass — nothing is ever
 * hidden or unreadable because an effect did not run.
 *
 * Serves the customer header, the seller and admin list toolbars, and can back a
 * table's sticky head.
 */
export interface StickyGlassBarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Distance from the top at which the bar sticks. Defaults to 0. */
  offset?: number;
  /** Element rendered instead of a div, e.g. "header" or "nav". */
  as?: React.ElementType;
  /**
   * Opt out of the continuous settle and keep round one's two-state cross. Use
   * for a bar that is not at the top of the document, where a root scroll
   * timeline would report progress the bar has nothing to do with.
   */
  settle?: boolean;
}

export function StickyGlassBar({
  children,
  offset = 0,
  as,
  settle = true,
  className,
  ...props
}: StickyGlassBarProps) {
  const Comp: React.ElementType = as ?? "div";
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = React.useState(false);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setAtTop(Boolean(entry?.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (!settle) {
    // The round-one behaviour, unchanged, for bars that are not the document's
    // own chrome.
    return (
      <>
        <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
        <Comp
          data-rung={atTop ? 0 : 4}
          data-glass={atTop ? undefined : "true"}
          className={cn("sticky z-sticky w-full rounded-none border-x-0 border-t-0", atTop && "border-b-0", className)}
          style={{ top: offset }}
          {...props}
        >
          {children}
        </Comp>
      </>
    );
  }

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      <Comp
        // Always rung 4 and always glass now. The bar no longer has an "off"
        // state to flash through on a slow hydrate; it has a thin state and a
        // thick one, and both are legible.
        data-rung={4}
        data-glass="true"
        data-at-top={atTop ? "true" : "false"}
        className={cn("u-chrome sticky z-sticky w-full rounded-none border-x-0 border-t-0", className)}
        style={{ top: offset }}
        {...props}
      >
        {children}
      </Comp>
    </>
  );
}
