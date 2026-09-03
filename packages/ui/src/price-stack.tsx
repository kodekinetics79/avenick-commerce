import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * PriceStack — the price block, and the reason B2B and B2C prices are visibly
 * different OBJECTS rather than the same object with different words.
 *
 * WHY THE TWO SHAPES DIFFER, and it is regulation rather than taste: UAE FTA
 * rules require consumer prices to be displayed VAT-inclusive, with an explicit
 * exception for supplies to VAT-registered businesses PROVIDED the exclusion is
 * stated. So the B2C block is one inclusive figure with "Incl. VAT" under it,
 * and the B2B block is an exclusive figure, a stated exclusion, and the computed
 * inclusive figure as a secondary line. The asymmetry is what makes the B2B
 * surface feel like a more serious product; it is also what keeps it legal.
 *
 * THE QUALIFIER IS A SEPARATE RUN. "From" used to be baked into the formatted
 * string, which rendered it at the figure's own rank and collapsed the 3×
 * figure-to-label ratio at exactly the place a shopper looks first. It is a
 * .u-meta run beside the figure now.
 *
 * THE CURRENCY MARK LIVES INSIDE THE FIGURE RUN — never superscripted, never a
 * different colour. A raised or coloured currency mark is discount-retail
 * signalling, and this is trade.
 *
 * Takes STRINGS, already formatted and already localised by the caller. Never a
 * message key and never a number: packages/ui is locale-free, and formatting
 * money is @avenick/utils' job.
 */
export interface PriceStackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The formatted amount, currency mark included. */
  amount: string;
  /** e.g. "From". Rendered beside the figure at metadata rank, never inside it. */
  qualifier?: string;
  /** e.g. "Incl. VAT" / "Excl. VAT". Required by law to be stated on B2B. */
  vat?: string;
  /** B2B only: the computed inclusive figure, already formatted. */
  secondary?: string;
  /** Figure rank. `card` is the shopfront price; `inline` is a list line. */
  rank?: "card" | "inline";
}

export function PriceStack({
  amount,
  qualifier,
  vat,
  secondary,
  rank = "card",
  className,
  ...props
}: PriceStackProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)} {...props}>
      <div className="flex items-baseline gap-1.5">
        {qualifier && <span className="u-meta text-ink-3">{qualifier}</span>}
        <span
          className={cn(
            "fig text-ink-1",
            rank === "card" ? "u-fig-card" : "text-fig-inline font-medium",
          )}
        >
          {amount}
        </span>
      </div>
      {vat && <span className="u-meta text-ink-3">{vat}</span>}
      {secondary && <span className="u-meta text-ink-3">{secondary}</span>}
    </div>
  );
}
