import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Num — every figure in the product.
 *
 * Three jobs:
 *
 * 1. It carries the rank ratio. A metric's figure is at least 3× its label, and
 *    "inline / section / hero" are the only three sizes a figure may be. That
 *    ratio is the actual hierarchy fix; the elevation ladder cannot create
 *    hierarchy on its own while every string is still bold.
 * 2. Tabular figures, so a column of money aligns down the column. It also ends
 *    the `font-mono` price: --font-mono is referenced by the Tailwind config but
 *    was defined in no stylesheet, so every price on the platform fell through
 *    to a different monospace face per operating system. Mono is now reserved
 *    for SKUs, order references, tracking IDs and hashes.
 * 3. It structurally guarantees the digits are never the animated element. There
 *    is no count-up anywhere in this product: in a codebase that just finished
 *    removing untrue surfaces, every intermediate frame of a ticking figure
 *    displays a financial number that is false. Animate the container.
 *
 * Prices stay in Western digits in both locales — GCC commerce convention, and a
 * deliberate decision recorded here so nobody "fixes" it.
 */
export interface NumProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string | number;
  rank?: "inline" | "section" | "hero";
  /** Rendered at 0.5em in the metadata ink, before the figure. */
  currency?: string;
  /** Rendered at 0.5em in the metadata ink, after the figure. */
  unit?: string;
}

export function Num({ value, rank = "inline", currency, unit, className, ...props }: NumProps) {
  const size =
    rank === "hero" ? "text-fig-hero" : rank === "section" ? "text-fig-section" : "text-fig-inline";

  return (
    <span
      className={cn("fig inline-flex items-baseline gap-1 text-ink-1", size, className)}
      // Weight comes from the rank token rather than a utility class, because
      // hero rank is the one place in the product allowed to reach 700 and
      // `font-bold` is deliberately remapped to 600 everywhere else.
      style={{ fontWeight: `var(--fw-fig-${rank})` }}
      {...props}
    >
      {currency && <span className="text-[0.5em] font-medium text-ink-3">{currency}</span>}
      <span>{value}</span>
      {unit && <span className="text-[0.5em] font-medium text-ink-3">{unit}</span>}
    </span>
  );
}
