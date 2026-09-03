import * as React from "react";
import { Dateline, Num } from "@avenick/ui";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";

/**
 * Money — one amount, rendered in the currency it was actually recorded in.
 *
 * Every figure in the buyer suite used to be `formatCurrency(...)` dropped into
 * a `font-mono font-bold` span. Two problems: --font-mono resolved to a
 * different face on every operating system, and the currency code rendered at
 * the same size as the digits, so a column of money had no visual spine.
 *
 * <Num> already solves both — tabular figures, the code at 0.5em in the
 * metadata ink — but it wants the code and the amount separately, while
 * formatCurrency hands back one string. Splitting here rather than re-deriving
 * the amount keeps ONE implementation of decimal places and grouping: KWD, BHD
 * and OMR are three-decimal currencies, and that knowledge lives in
 * @avenick/utils, not in a page.
 */
export function moneyParts(amount: number, currency: string): { code?: string; figure: string } {
  const text = formatCurrency(amount, currency as SupportedCurrency);
  // English formatting is "<CODE> <amount>". If a future locale or an unknown
  // currency ever produces something else, the whole string is shown as the
  // figure rather than half of it being silently dropped.
  const split = text.indexOf(" ");
  if (split === -1) return { figure: text };
  return { code: text.slice(0, split), figure: text.slice(split + 1) };
}

export function Money({
  amount,
  currency,
  rank = "inline",
  className,
}: {
  amount: number;
  currency: string;
  rank?: "inline" | "section" | "hero";
  className?: string;
}) {
  const { code, figure } = moneyParts(amount, currency);
  return <Num value={figure} currency={code} rank={rank} className={className} />;
}

/**
 * MoneyStack — several amounts that are NOT a total.
 *
 * The platform holds no exchange rates, so a lifetime spend of SAR 40,000 and
 * AED 12,000 is two facts, never one number. Stacking them is the design: each
 * currency keeps its own line, and the provenance line says why there is no
 * single figure rather than leaving the reader to assume one was lost.
 */
export function MoneyStack({
  rows,
  rank = "inline",
  dateline,
  emptyLabel = "—",
}: {
  rows: Array<{ currency: string; total: number }>;
  rank?: "inline" | "section" | "hero";
  /** Provenance for the whole stack. Omit only when the caller states it. */
  dateline?: string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <Num value={emptyLabel} rank={rank} />;
  }
  return (
    <div>
      <div className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <Money key={row.currency} amount={row.total} currency={row.currency} rank={rank} />
        ))}
      </div>
      {dateline && <Dateline className="mt-1">{dateline}</Dateline>}
    </div>
  );
}
