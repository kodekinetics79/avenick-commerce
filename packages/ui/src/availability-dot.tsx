import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * AvailabilityDot — one stock language across three portals.
 *
 * The same dot a buyer sees on the storefront appears in the seller's inventory
 * table and the admin stock console. That is the cheapest possible coherence
 * between three products that are meant to be one.
 *
 * COLOUR IS NEVER THE ONLY CHANNEL. The dot is always paired with its own text
 * label, which the caller supplies from the message tree — packages/ui stays
 * locale-free, so this component takes a STRING, never a message key.
 *
 * 6px with a 3px ring at ~15% alpha. The ring is what makes a 6px dot read as a
 * lamp rather than as a full stop. It never pulses: a pulsing dot beside a
 * number read sixty times a day is fatigue, not urgency.
 */
export type StockState = "IN_STOCK" | "OUT_OF_STOCK" | "UNCONFIRMED";

const TONE: Record<StockState, string> = {
  IN_STOCK: "var(--success)",
  OUT_OF_STOCK: "var(--danger)",
  UNCONFIRMED: "var(--ink-3)",
};

export interface AvailabilityDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: StockState;
  /** The state in words, already localised by the caller. Required. */
  label: string;
}

export function AvailabilityDot({ state, label, className, ...props }: AvailabilityDotProps) {
  return (
    <span className={cn("u-meta inline-flex items-center gap-1.5 text-ink-2", className)} {...props}>
      <span
        className="u-dot shrink-0"
        style={{ ["--dot-tone" as string]: TONE[state] }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
