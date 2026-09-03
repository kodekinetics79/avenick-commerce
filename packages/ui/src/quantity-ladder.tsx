import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * QuantityLadder — the quantity-break table, and the tile that reads as
 * procurement software.
 *
 * Dense, numeric, tabular and completely true: it renders break quantities that
 * already exist on the product, fed by the `priceTiered` flag currently being
 * spent on a single grey word. Nothing on a consumer storefront looks like this,
 * which is the point — a Gulf procurement manager reads it as software built for
 * him rather than as a shop that also sells to businesses.
 *
 * IT IS A REAL <table>. It is tabular data, and a screen-reader user must be
 * able to navigate it by column. The caption is sr-only and the headers are
 * scoped.
 *
 * Brass marks the band the buyer's quantity actually falls in, because "the tier
 * you are in" is literally a tier mark — one of brass's three legal uses. The
 * inline-start rule is always 3px and always present; only its colour changes,
 * exactly as <CommitRow> does, so marking the active band cannot reflow the tile.
 *
 * GATED ON isB2B BY THE CALLER. A consumer seeing wholesale breaks is a pricing
 * leak. Renders NOTHING for a single-price product — an empty ladder is worse
 * than no ladder.
 *
 * All strings arrive already formatted and already localised. packages/ui is
 * locale-free.
 */
export interface QuantityTier {
  /** e.g. "1–49". Already formatted by the caller. */
  band: string;
  /** e.g. "AED 42.00". Already formatted by the caller. */
  price: string;
  /** Lower bound of the band, used to resolve `activeQty`. */
  from: number;
  /** Upper bound, or null for the open-ended top band. */
  to?: number | null;
}

export interface QuantityLadderProps extends React.HTMLAttributes<HTMLTableElement> {
  tiers: QuantityTier[];
  /** The buyer's current quantity. Marks the band it falls in, if any. */
  activeQty?: number;
  /** Bands to show. 3 on a tile — never a scrollbar. Omit the cap on the PDP. */
  max?: number;
  /** sr-only caption, e.g. "Price per unit by quantity". Required. */
  caption: string;
  /** Column headers, already localised. */
  headers: { qty: string; unitPrice: string };
}

export function QuantityLadder({
  tiers,
  activeQty,
  max = 3,
  caption,
  headers,
  className,
  ...props
}: QuantityLadderProps) {
  // A single price is not a ladder. Rendering a one-row table with a heading
  // above it is how a truthful surface starts looking padded.
  if (!tiers || tiers.length < 2) return null;

  const shown = max > 0 ? tiers.slice(0, max) : tiers;

  return (
    <table className={cn("qty-ladder", className)} {...props}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{headers.qty}</th>
          <th scope="col">{headers.unitPrice}</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((tier) => {
          const active =
            activeQty !== undefined &&
            activeQty >= tier.from &&
            (tier.to === null || tier.to === undefined || activeQty <= tier.to);
          return (
            <tr key={`${tier.from}-${tier.band}`} data-active={active ? "true" : undefined}>
              <td>{tier.band}</td>
              <td className="fig">{tier.price}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
