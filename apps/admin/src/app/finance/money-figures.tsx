import * as React from "react";
import { Eyebrow, Num, Dateline } from "@avenick/ui";
import { cn } from "@avenick/utils";

/**
 * The money figure, as this platform is allowed to state it.
 *
 * Every finance surface in the console has the same problem: a figure is only
 * true inside one currency. The platform holds no exchange rates, so AED and SAR
 * are never added, and a tile that shows one number is therefore either wrong or
 * hiding a currency. Every one of these screens solved that independently, with
 * a `.map()` producing stacked `text-xl font-bold` paragraphs and a grey caption
 * — which is why the same fact read differently on Payments, Settlements,
 * Finance and VAT.
 *
 * This is that fact, once: a label, one tabular figure per currency, and the
 * provenance line that says what the figure counts and over what window. It
 * lives under /finance because that is where the money vocabulary belongs; the
 * other money screens import it so the reading is identical everywhere.
 *
 * Amounts arrive pre-formatted. Money crosses to a string in the page that owns
 * the query, next to the currency it was billed in — never here.
 */
export interface MoneyLine {
  /** Currency code, used as the React key and as the disambiguator. */
  currency: string;
  /** Already through formatCurrency(), in that currency. */
  formatted: string;
}

export interface MoneyStatProps {
  label: string;
  lines: MoneyLine[];
  /** Figure rank. `section` is for the one figure a screen is actually about. */
  rank?: "inline" | "section" | "hero";
  /** A short plain-language qualifier, e.g. "12 payments". */
  note?: React.ReactNode;
  /** Provenance: what this counts, over what window, and what it excludes. */
  dateline?: string;
  /** Shown instead of the figures when there is nothing recorded. */
  empty?: string;
  className?: string;
}

export function MoneyStat({
  label,
  lines,
  rank = "inline",
  note,
  dateline,
  empty = "—",
  className,
}: MoneyStatProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <Eyebrow className="truncate">{label}</Eyebrow>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {lines.length === 0 ? (
          <Num value={empty} rank={rank} className="text-ink-3" />
        ) : (
          // One line per currency. Two currencies stacked is the honest shape of
          // this number; one line with a converted total would be a fiction.
          lines.map((line) => <Num key={line.currency} value={line.formatted} rank={rank} />)
        )}
      </div>
      {note && <p className="u-meta mt-1 text-ink-2">{note}</p>}
      {dateline && <Dateline className="mt-1">{dateline}</Dateline>}
    </div>
  );
}

/**
 * A count, a ratio or any other figure that is not money, shaped exactly like
 * MoneyStat so a band mixing the two still reads as one band. Kept here rather
 * than reaching for <Stat> because <Stat> owns its own icon-chip vocabulary and
 * these bands deliberately carry no chips: in a console, colour is state.
 */
export interface CountStatProps {
  label: string;
  value: React.ReactNode;
  rank?: "inline" | "section" | "hero";
  note?: React.ReactNode;
  dateline?: string;
  /** Tints the figure. Reserved for a figure whose value IS a state. */
  tone?: "default" | "warning" | "danger" | "success";
  className?: string;
}

const TONE_CLASS: Record<NonNullable<CountStatProps["tone"]>, string> = {
  default: "",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
  success: "text-success-ink",
};

export function CountStat({
  label,
  value,
  rank = "inline",
  note,
  dateline,
  tone = "default",
  className,
}: CountStatProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <Eyebrow className="truncate">{label}</Eyebrow>
      <div className="mt-1.5">
        <Num value={value as string} rank={rank} className={TONE_CLASS[tone]} />
      </div>
      {note && <p className="u-meta mt-1 text-ink-2">{note}</p>}
      {dateline && <Dateline className="mt-1">{dateline}</Dateline>}
    </div>
  );
}
