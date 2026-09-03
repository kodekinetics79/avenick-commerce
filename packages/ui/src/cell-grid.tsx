import * as React from "react";
import { cn } from "@avenick/utils";
import { Surface } from "./surface";

/**
 * CellGrid — one panel subdivided by hairlines, not N independently bordered boxes.
 *
 * Ten seller stat tiles and six admin KPIs used to be sixteen floating objects
 * with sixteen borders, sixteen radii and sixteen shadows. Here they are two
 * panels: one outer border, 1px hairline dividers, zero gap, no per-cell edge.
 * That single change drops the seller dashboard's visual object count from about
 * twenty to five, and it does more for "authoritative and dense" than any amount
 * of per-card styling could.
 *
 * The column counts are looked up from a static map rather than interpolated,
 * because a class string built at runtime is invisible to Tailwind's scanner and
 * would simply not be generated.
 */
type ColCount = 1 | 2 | 3 | 4 | 5 | 6;

const BASE_COLS: Record<ColCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};
const SM_COLS: Record<ColCount, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};
const LG_COLS: Record<ColCount, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

export interface CellGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: { base?: ColCount; sm?: ColCount; lg?: ColCount };
  /** "comfortable" is the default; "compact" suits an admin console band. */
  density?: "comfortable" | "compact";
  children: React.ReactNode;
}

export function CellGrid({
  cols = { base: 2, lg: 4 },
  density = "comfortable",
  className,
  children,
  ...props
}: CellGridProps) {
  return (
    <Surface
      rung={2}
      // The panel clips its own overflow so cell fills stay inside its radius,
      // which also slices off the outward focus ring of any focusable cell.
      // data-clips-focus redraws that ring inset — see globals.css.
      data-clips-focus=""
      className={cn(
        "overflow-hidden",
        // A 1px GAP filled by the hairline colour, with each cell painting its
        // own surface over it. Tailwind's divide-* utilities are border-based
        // and physical, and on a multi-row grid they leave a stray rule at the
        // start of every row; a gap has neither problem and is direction-neutral
        // by construction.
        "grid gap-px bg-hairline [&>*]:min-w-0 [&>*]:bg-surface-2",
        BASE_COLS[cols.base ?? 2],
        cols.sm ? SM_COLS[cols.sm] : "",
        cols.lg ? LG_COLS[cols.lg] : "",
        density === "compact" ? "[&>*]:p-3" : "[&>*]:p-4",
        className,
      )}
      {...props}
    >
      {children}
    </Surface>
  );
}

/**
 * StatGrid — CellGrid with the rank distribution enforced.
 *
 * A flat grid of ten tiles at uniform weight is structurally impossible here:
 * the first `leadCount` cells are promoted to section rank and span two columns,
 * everything after them is inline rank. Depth without rank is the same product
 * with more blur, so the primitive does not offer the flat version.
 */
export interface StatGridProps extends CellGridProps {
  /** How many leading cells are promoted. 1 or 2 — never more. */
  leadCount?: 1 | 2;
}

export function StatGrid({ leadCount = 1, className, children, ...props }: StatGridProps) {
  const items = React.Children.toArray(children);
  return (
    <CellGrid className={className} {...props}>
      {items.map((child, index) => (
        <div key={index} className={index < leadCount ? "col-span-2" : undefined}>
          {child}
        </div>
      ))}
    </CellGrid>
  );
}
