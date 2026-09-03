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
 * It writes --mx/--my at most once per animation frame, adds will-change on
 * enter and REMOVES it on leave (a will-change left standing in a stylesheet is
 * a real cost on mid-range Android), and early-returns before attaching any
 * listener at all on a coarse pointer or under reduced motion — the listener is
 * never registered, not merely made a no-op.
 *
 * Product cards, category tiles, and the single admin hero KPI. Never a table
 * row: 40 rows tracking a pointer is a composite storm.
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

    const onEnter = () => {
      el.style.willChange = "transform";
    };
    const onLeave = () => {
      el.style.willChange = "";
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.style.willChange = "";
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
