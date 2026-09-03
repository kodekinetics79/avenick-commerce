"use client";

import * as React from "react";

/**
 * SpecularSurface — feeds a pointer position to a <Surface specular>.
 *
 * This is the survivor of the 3D-tilt idea. A pointer-tracked specular gives the
 * same "this is a real material" read for one composited paint on one card, and
 * unlike a rotation it cannot be turned up too far by whoever implements it
 * next. Tilt is banned outright; so are blend modes.
 *
 * It writes --mx/--my at most once per animation frame, and early-returns before
 * attaching any listener at all on a coarse pointer or under reduced motion —
 * the listener is never registered, not merely made a no-op. Every new client
 * island in this system copies that guard shape verbatim.
 *
 * FIXED THIS ROUND: it used to set `will-change: transform` on pointerenter, on
 * a wrapper that never transforms. It promoted a compositor layer for zero
 * benefit and cost memory on exactly the mid-range Android this product must
 * serve. The rAF throttle and the two early-returns were already correct and are
 * untouched.
 *
 * Product cards, category tiles, and the single admin hero KPI. Never a table
 * row: 40 rows tracking a pointer is a composite storm.
 *
 * FOR A GRID, USE <LightGrid> INSTEAD. One pointermove listener on the container
 * beats N listeners on N cards, and the cards then read as one lit material
 * rather than as N independent hover states.
 */
export interface SpecularSurfaceProps {
  children: React.ReactNode;
  className?: string;
}

export function SpecularSurface({ children, className }: SpecularSurfaceProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      if (!pending) return;
      el.style.setProperty("--mx", `${pending.x}%`);
      el.style.setProperty("--my", `${pending.y}%`);
      pending = null;
    };

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pending = {
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
      };
      if (!frame) frame = window.requestAnimationFrame(flush);
    };

    el.addEventListener("pointermove", onMove);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
    };
  }, []);

  // Deliberately carries no visual styling of its own: the gradient lives on the
  // wrapped Surface's ::before, so this wrapper can never become a second card.
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
