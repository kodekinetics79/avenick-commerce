"use client";

import * as React from "react";

/**
 * LightGrid — ONE pointermove listener on a grid container, so a grid of product
 * cards reads as one lit material rather than as twenty-four independent hover
 * states.
 *
 * THE MISTAKE THIS EXISTS TO PREVENT: implementing the grid light as N per-card
 * listeners. Twenty-four pointermove handlers doing twenty-four rAF writes is
 * exactly the mid-range-Android jank law 7 names, and it is the obvious
 * implementation. One listener, one rAF flush, and each child reads --mx/--my
 * computed from its own rect.
 *
 * The guard shape is copied verbatim from <SpecularSurface>, and it is the shape
 * every new island in this system copies: the listener is never REGISTERED on a
 * coarse pointer or under reduced motion, rather than being registered and made
 * a no-op. On a phone, nothing is attached at all.
 *
 * Beyond 24 children it skips anything outside a 1.5× viewport band, because a
 * category page with 96 tiles would otherwise measure 96 rects per frame.
 *
 * NEVER wrap a table with this. Forty rows tracking a pointer is a composite
 * storm — <SpecularSurface>'s docstring has said so since round one and the
 * ergonomics of this component make it trivially easy to wrap the wrong thing.
 */
export interface LightGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** CSS selector for the tracked children, relative to the container. */
  itemSelector?: string;
  children: React.ReactNode;
}

export function LightGrid({
  itemSelector = "[data-specular]",
  className,
  children,
  ...props
}: LightGridProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.documentElement.hasAttribute("data-save-data")) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      const point = pending;
      pending = null;
      if (!point) return;

      const items = Array.from(root.querySelectorAll<HTMLElement>(itemSelector));
      // Past 24 tiles the cost of measuring every rect outstrips the effect, so
      // anything more than half a viewport away from the pointer is skipped.
      const band = items.length > 24 ? window.innerHeight * 0.75 : Infinity;

      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (Math.abs(rect.top + rect.height / 2 - point.y) > band) continue;
        item.style.setProperty("--mx", `${((point.x - rect.left) / rect.width) * 100}%`);
        item.style.setProperty("--my", `${((point.y - rect.top) / rect.height) * 100}%`);
      }
    };

    const onMove = (event: PointerEvent) => {
      pending = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(flush);
    };

    root.addEventListener("pointermove", onMove);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", onMove);
    };
  }, [itemSelector]);

  // Carries no visual styling of its own, so it can never become a second card.
  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
}
