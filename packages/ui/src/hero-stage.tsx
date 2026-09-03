import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * HeroStage / HeroCopy / HeroSpecimen — the composition, as three pieces, so no
 * surface team hand-rolls a hero.
 *
 * THE FAILURE THIS EXISTS TO PREVENT: raising --fs-hero to 92px is the cheapest
 * half of the change and it is the half that does not work alone. A 92px
 * headline over a near-empty ground with a 15px lead and no specimen is a bigger
 * version of the current problem — a document with a shouty first line. The hero
 * is a COMPOSITION: seven columns of copy against four holding one real object,
 * dropped to meet the CTA baseline, on a lit and ruled ground. Ship the grid and
 * the specimen or do not ship the type.
 *
 * DEPTH IS Z-POSITION, NEVER ROTATION. Three planes maximum at translateZ 0 /
 * −110 / −260 inside a bounded perspective box. The FRONT plane — every word,
 * price and control — stays in normal document flow, so the stage's height is
 * content-driven, `contain: paint` can never clip a headline, and if no
 * animation ever runs the composition is simply a grid.
 *
 * ONE STAGE PER SITE. A second instance halves the impact of the first and
 * doubles the cost.
 *
 * Server Components, all three. Nothing here needs the client.
 */
export interface HeroStageProps extends React.HTMLAttributes<HTMLElement> {
  /** 1 renders the grid alone; 3 adds the two decorative depth planes. */
  planes?: 1 | 3;
  /** Content of the mid plane, e.g. a <DisplayPlate>. Purely decorative. */
  midPlane?: React.ReactNode;
  /** Content of the back plane. Purely decorative — it drifts on scroll. */
  backPlane?: React.ReactNode;
  as?: React.ElementType;
  children: React.ReactNode;
}

export function HeroStage({
  planes = 1,
  midPlane,
  backPlane,
  as,
  className,
  children,
  ...props
}: HeroStageProps) {
  const Comp: React.ElementType = as ?? "section";
  return (
    <Comp className={cn("u-stage", className)} {...props}>
      {planes === 3 && (
        <>
          {/* aria-hidden and pointer-events:none in CSS: these carry no content
              and must never intercept a click meant for the copy above them. */}
          <div className="u-plane" data-z="back" aria-hidden="true">
            {backPlane}
          </div>
          <div className="u-plane" data-z="mid" aria-hidden="true">
            {midPlane}
          </div>
        </>
      )}
      <div className="u-plane u-hero-grid" data-z="front">
        {children}
      </div>
    </Comp>
  );
}

/** The seven-column copy well. `grid-column` is logical, so it mirrors for free. */
export function HeroCopy({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("u-hero-copy flex flex-col gap-stack", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * The four-column specimen slot, dropped to meet the CTA row's baseline.
 *
 * THE RULE THAT OUTRANKS EVERYTHING ELSE IN THIS FILE: when a layout has a hole
 * in it, the answer is a better empty state, NEVER a plausible number. This slot
 * holds one real product from the catalogue fetch the page already does. If the
 * catalogue is empty it holds an <EmptyState variant="certificate" scale="hero">
 * — never a placeholder product, never a stock photograph, never a rating, never
 * a "trusted by" strip. A gorgeous lie is the one unsurvivable failure.
 */
export function HeroSpecimen({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("u-hero-specimen", className)} {...props}>
      {children}
    </div>
  );
}
