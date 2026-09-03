import * as React from "react";
import { cn } from "@avenick/utils";
import { Dateline, Eyebrow, Num } from "@avenick/ui";
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

export type MoneyRank = "inline" | "card" | "section" | "hero";

/** `card` is 22px — the rung between a 20px dashboard stat and a 30px section figure. */
function numRank(rank: MoneyRank): "inline" | "section" | "hero" {
  return rank === "card" ? "inline" : rank;
}

export function Money({
  amount,
  currency,
  rank = "inline",
  className,
}: {
  amount: number;
  currency: string;
  rank?: MoneyRank;
  className?: string;
}) {
  const { code, figure } = moneyParts(amount, currency);
  return <Figure figure={figure} code={code} rank={rank} className={className} />;
}

/**
 * The figure itself. Split out because the ledger below prints the currency code
 * in its own column and must NOT repeat it inline — a code shown twice in one
 * row is the tell that a component was reused without being looked at.
 */
function Figure({
  figure,
  code,
  rank,
  className,
}: {
  figure: string;
  code?: string;
  rank: MoneyRank;
  className?: string;
}) {
  if (rank === "card") {
    // The one rung <Num> does not carry. Same tabular figures, same code in the
    // metadata ink — written here rather than hand-rolled in a page, so there is
    // still exactly one implementation of a money figure in the buyer suite.
    return (
      <span className={cn("u-fig-card tnum inline-flex items-baseline gap-1.5 text-ink-1", className)}>
        {code && <span className="u-meta text-ink-3">{code}</span>}
        {figure}
      </span>
    );
  }
  return <Num value={figure} currency={code} rank={numRank(rank)} className={className} />;
}

export interface LedgerRow {
  currency: string;
  total: number;
}

/**
 * CurrencyLedger — several amounts that are NOT a total, set as a register.
 *
 * THE PLATFORM HOLDS NO EXCHANGE RATES. A lifetime spend of SAR 40,000 and
 * AED 12,000 is two facts, never one number, and this component is the one place
 * in the buyer suite that says so. Round one got the LOGIC right and then set the
 * disclosure as an 11px grey line under a stack of figures, which reads as an
 * apology for a missing feature. It is the opposite: it is the reason every
 * figure on the page can be trusted.
 *
 * So it is composed as a ruled ledger rather than a list:
 *
 *   · a brass rule drawn across the top edge — the same `.u-drawn` gesture as
 *     active nav, a selected tab and the certificate's top edge, in a fourth
 *     posture, because a ledger head is exactly what that rule marks;
 *   · the currency code in mono micro-caps in its own fixed column, so the
 *     FIGURES form a single tabular spine down the inline end and two rows can
 *     actually be compared by eye;
 *   · one hairline between rows, the same rule <LedgerTable> draws;
 *   · the disclosure in the provenance voice — Source Serif italic in English,
 *     upright Noto Naskh in Arabic — attached to the object it explains.
 *
 * A single-currency company gets no ceremony: one figure, and the shorter
 * statement of which currency it is in. Ritual around a one-line ledger is what
 * makes the multi-currency case stop reading as significant.
 */
export function CurrencyLedger({
  rows,
  rank = "inline",
  label,
  single,
  multi,
  emptyLabel,
  className,
}: {
  rows: LedgerRow[];
  rank?: MoneyRank;
  /** Micro-caps label for the ledger head. Only rendered when there is more than one row. */
  label?: string;
  /** Provenance for the one-currency case, e.g. "Recorded in AED." */
  single?: string;
  /** Provenance for the several-currency case. This is the no-exchange-rate statement. */
  multi?: string;
  /** Shown when there is nothing recorded at all. Never a zero — zero is a claim. */
  emptyLabel?: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className={className}>
        <Num value="—" rank={numRank(rank)} />
        {emptyLabel && <Dateline className="mt-1">{emptyLabel}</Dateline>}
      </div>
    );
  }

  if (rows.length === 1) {
    const row = rows[0]!;
    return (
      <div className={className}>
        <Money amount={row.total} currency={row.currency} rank={rank} />
        {single && <Dateline className="mt-1">{single}</Dateline>}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* The register head. Same brass rule, same easing, same width as the
          certificate's top edge — one gesture in a fourth posture, never a
          fifth gesture with its own timing. */}
      <div className="u-drawn w-10" data-on="true" aria-hidden="true" />
      {label && <Eyebrow className="mt-1.5">{label}</Eyebrow>}
      <dl className="mt-1.5">
        {rows.map((row) => (
          <div
            key={row.currency}
            // grid, not flex-between: a fixed code column is what makes the
            // figures share one tabular spine at the inline end. text-end and
            // justify-self-end, never text-right — this column is the inline
            // end, which is the LEFT edge in Arabic.
            className="grid grid-cols-[3.25rem_1fr] items-baseline gap-3 border-b border-hairline py-1.5 last:border-b-0"
          >
            <dt className="u-mono u-micro text-ink-3">{row.currency}</dt>
            <dd className="justify-self-end text-end">
              {/* No `code`: the dt column already carries it. */}
              <Figure figure={moneyParts(row.total, row.currency).figure} rank={rank} />
            </dd>
          </div>
        ))}
      </dl>
      {multi && <Dateline className="mt-2">{multi}</Dateline>}
    </div>
  );
}
