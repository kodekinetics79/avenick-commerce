import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Dateline — the provenance line, and a first-class element rather than fine print.
 *
 * LAW E. This codebase went through a long hardening programme removing things
 * that were not true, and the residue currently renders as 11px grey apologies:
 * "no conversion between currencies is applied", "No prior-month figure",
 * "orders from the last N days". A publication cites its sources. Stating
 * precisely what a figure is and is not is the thing that makes the platform
 * read as authoritative, instead of the thing that makes it read as thin.
 *
 * Set in Source Serif 4 italic at the metadata size. Under [dir="rtl"] the
 * .u-provenance utility swaps it to upright IBM Plex Sans Arabic 400 at the same
 * size and colour — Arabic has no italic, and obliquing a serif to fake one is
 * the mark of a product that did not look.
 *
 * Never put a claim here that the data does not support. It is a citation, not a
 * caption.
 */
export interface DatelineProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** What the figure is measured from, e.g. "Paid order totals, as recorded". */
  basis?: string;
  /** The window it covers, e.g. "last 30 days". */
  window?: string;
  /** When it was computed, already formatted by the caller. */
  asOf?: string;
  children?: React.ReactNode;
}

export function Dateline({ basis, window: windowLabel, asOf, children, className, ...props }: DatelineProps) {
  // The parts are joined with a middot so a caller can supply any subset without
  // ending up with a dangling separator.
  const parts = [basis, windowLabel, asOf].filter(Boolean) as string[];

  if (parts.length === 0 && !children) return null;

  return (
    <p className={cn("u-provenance", className)} {...props}>
      {children}
      {children && parts.length > 0 ? " · " : null}
      {parts.join(" · ")}
    </p>
  );
}
