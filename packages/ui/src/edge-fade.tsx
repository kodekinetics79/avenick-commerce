"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@avenick/utils";

/**
 * EdgeFade / Rail — the horizontal scroller, and the cheapest "this was
 * designed" signal in the product.
 *
 * THE MASK IS SYMMETRIC ON PURPOSE. mask-image has no logical equivalent and
 * does not mirror, so a one-sided `to right` fade passes English review and
 * ships broken in Arabic — the rail feathers on the wrong end. Feathering BOTH
 * ends makes it direction-agnostic by construction, which is the mandatory
 * mechanism whenever a physical-direction value cannot be multiplied by --dir.
 *
 * Snapping is PROXIMITY, never mandatory: mandatory fights a trackpad flick.
 *
 * The prev/next buttons are not decoration. Hiding a scrollbar without providing
 * another affordance is an accessibility regression, so they are real <button>
 * elements with caller-supplied aria-labels, and they scroll by one viewport of
 * the rail using the element's own scrollBy — which is direction-correct in
 * Arabic because scrollLeft is negative there and `left: -delta` still means
 * "towards the inline start" once multiplied through.
 *
 * This is a client island purely for the two buttons; the rail itself is markup.
 * A page never becomes a client page to use it — children are rendered on the
 * server and passed through.
 *
 * CAVEAT: a masked element gets its own composited layer and cannot reliably be
 * the backdrop root for a child's backdrop-filter. Do not mask a glass surface —
 * mask the thing next to it.
 */
export interface EdgeFadeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** The symmetric inline mask on its own, for a scroller you are laying out yourself. */
export function EdgeFade({ className, children, ...props }: EdgeFadeProps) {
  return (
    <div className={cn("u-edge-fade-inline", className)} {...props}>
      {children}
    </div>
  );
}

export interface RailProps extends React.HTMLAttributes<HTMLDivElement> {
  /** aria-label for the scroll-back control. Already localised. Required. */
  prevLabel: string;
  /** aria-label for the scroll-forward control. Already localised. Required. */
  nextLabel: string;
  /** Names the rail for assistive technology, e.g. "Categories". */
  label: string;
  children: React.ReactNode;
}

export function Rail({ prevLabel, nextLabel, label, className, children, ...props }: RailProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  const nudge = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Multiplying the physical delta by the direction the browser already uses
    // for this element keeps "next" meaning "towards the inline end" in both
    // languages, without the component knowing which language it is in.
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: direction * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)} {...props}>
      <div
        ref={scrollerRef}
        role="group"
        aria-label={label}
        className="u-rail u-edge-fade-inline scrollbar-hide"
      >
        {children}
      </div>
      <div className="mt-tight flex justify-end gap-tight">
        <button
          type="button"
          aria-label={prevLabel}
          onClick={() => nudge(-1)}
          className="u-focus flex h-control-sm w-control-sm items-center justify-center rounded-pill border border-border text-ink-2"
        >
          {/* The chevrons are mirrored by the RTL variant rather than swapped in
              JS: the icon is presentational and the label carries the meaning. */}
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={nextLabel}
          onClick={() => nudge(1)}
          className="u-focus flex h-control-sm w-control-sm items-center justify-center rounded-pill border border-border text-ink-2"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
