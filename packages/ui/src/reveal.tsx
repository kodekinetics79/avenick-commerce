import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Reveal — marks a block for the staged entrance. Server-safe: it emits a data
 * attribute and a stagger index and nothing else, so a page never has to become
 * a client component to get an entrance.
 *
 * THE JS-OFF CONTRACT. The base stylesheet renders every [data-reveal] element
 * VISIBLE. The hidden pre-reveal state is applied by <RevealRoot> only after it
 * has confirmed the element is below the fold. If JavaScript never runs, if
 * hydration fails, or if the observer never fires, all content is simply there.
 * Content that is invisible without JS is a broken page, not an animation.
 *
 * The stagger is capped at six children: past six the last card in a row is
 * waiting a quarter of a second for no reason. Storefront only — tables never
 * stagger, and reveals are off entirely in admin, because a console has to be
 * fully readable at t=0.
 */
export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  /** Position in the stagger. Anything past 6 inherits the sixth's delay. */
  index?: number;
  as?: React.ElementType;
}

export function Reveal({ index = 0, as, className, style, children, ...props }: RevealProps) {
  const Comp: React.ElementType = as ?? "div";
  return (
    <Comp
      data-reveal=""
      className={className}
      style={{ ...style, ["--reveal-index" as string]: Math.min(index, 5) } as React.CSSProperties}
      {...props}
    >
      {children}
    </Comp>
  );
}

/** Convenience wrapper: staggers its own children without the caller counting. */
export function RevealGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(className)}>
      {React.Children.toArray(children).map((child, index) => (
        <Reveal key={index} index={index}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
