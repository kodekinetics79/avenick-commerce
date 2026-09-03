import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * A time-series column chart drawn entirely with design tokens and no JavaScript.
 *
 * It lives beside the analytics page rather than in packages/ui because the
 * Meridian primitives ship <Meter> — a single linear bar — and no chart. The
 * performance page imports it from here so the two seller charts cannot drift
 * into two different chart styles; if a second portal ever needs a column
 * chart, this file is the one to promote into packages/ui.
 *
 * Two decisions worth keeping:
 *
 *  · Every column prints its value as text above the bar, so the series is
 *    readable without interpreting heights. A chart nobody can read at a glance
 *    is decoration, and decoration that carries no information is the thing this
 *    redesign is removing.
 *  · A column whose value is zero draws NO bar. A minimum-height stub would put
 *    a mark on the page where the seller recorded nothing, which is exactly the
 *    class of small untruth this codebase spent a hardening programme removing.
 *
 * Column order needs no RTL handling: the row is a flex container, so Arabic
 * reverses it and the most recent month lands at the inline end in both
 * directions. The fill is --accent rather than --primary because the seller
 * portal's primary-fill budget is one call to action per view.
 */
export interface ColumnDatum {
  /** Axis label, e.g. a month abbreviation. */
  label: string;
  value: number;
  /** The value as the reader should see it — already abbreviated or formatted. */
  caption: string;
  /** The exact value, for the hover title and for assistive technology. */
  exact?: string;
}

export interface ColumnChartProps {
  data: ColumnDatum[];
  /** Accessible name for the series, e.g. "Revenue by month". */
  label: string;
  /** Height of the plot area. Tailwind height class. */
  plotHeight?: string;
  className?: string;
}

export function ColumnChart({ data, label, plotHeight = "h-40", className }: ColumnChartProps) {
  // A zero maximum would divide by zero; a max of 1 renders every column empty,
  // which is the honest picture when nothing was recorded in the window.
  const max = Math.max(1, ...data.map((datum) => datum.value));

  return (
    <div className={className}>
      <div role="list" aria-label={label} className={cn("flex items-stretch gap-2 border-b border-border-strong sm:gap-3", plotHeight)}>
        {data.map((datum) => (
          <div role="listitem" key={datum.label} className="flex min-w-0 flex-1 flex-col">
            {/* One string per column for assistive technology, so a screen reader
                is never handed a row of numbers followed by a row of months. */}
            <span className="sr-only">
              {datum.label}: {datum.exact ?? datum.caption}
            </span>
            <span aria-hidden="true" className="fig u-meta text-center text-ink-2">
              {datum.caption}
            </span>
            <div className="flex flex-1 items-end justify-center">
              {datum.value > 0 && (
                <div
                  aria-hidden="true"
                  title={datum.exact}
                  className="w-full max-w-[44px] rounded-t-nested bg-accent"
                  style={{ height: `${Math.max(3, (datum.value / max) * 100)}%` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-2 sm:gap-3">
        {data.map((datum) => (
          <span key={datum.label} className="u-micro min-w-0 flex-1 text-center text-ink-3">
            {datum.label}
          </span>
        ))}
      </div>
    </div>
  );
}
