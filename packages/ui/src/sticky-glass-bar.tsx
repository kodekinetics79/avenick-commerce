"use client";

import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * StickyGlassBar — chrome that starts flush and crosses to rung-4 glass on first
 * scroll.
 *
 * Driven by an IntersectionObserver on a 1px sentinel, never by a scroll
 * listener: a scroll handler fires on every frame of every scroll in the app for
 * a boolean that changes twice.
 *
 * The default state is GLASS, and JavaScript's only job is to take the glass
 * AWAY while the page is at the top. With JS off, with the observer never
 * firing, or before hydration, the bar is simply always frosted — nothing is
 * ever hidden or unreadable because an effect did not run.
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
}

export function StickyGlassBar({ children, offset = 0, as, className, ...props }: StickyGlassBarProps) {
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

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      <Comp
        data-rung={atTop ? 0 : 4}
        data-glass={atTop ? undefined : "true"}
        className={cn(
          "sticky z-sticky w-full rounded-none border-x-0 border-t-0",
          atTop && "border-b-0",
          className,
        )}
        style={{ top: offset }}
        {...props}
      >
        {children}
      </Comp>
    </>
  );
}
