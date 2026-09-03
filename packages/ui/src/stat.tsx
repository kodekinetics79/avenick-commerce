import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@avenick/utils";
import { Eyebrow } from "./eyebrow";
import { Num } from "./num";
import { Dateline } from "./dateline";

/**
 * Stat — one figure and everything that qualifies it. Replaces metric-card.
 *
 * The old MetricCard shipped three defects into every portal at once:
 * `text-slate-800` hardcoded on the value (near-invisible in dark mode),
 * `ml-auto` on the trend (a physical property inside a shared primitive, i.e. a
 * law-3 violation shipping everywhere), and exactly one size for every context —
 * a month of GMV and a pending-count rendered at identical weight, which is why
 * nothing could be subordinate to anything.
 *
 * `chip` has exactly four semantic states. Four is what lets the seller
 * dashboard's ten-hue icon rainbow die: ten colours carrying zero information is
 * the loudest amateur signal in the product.
 *
 * `deltaWithheld` renders the honest "No prior-month figure" line as a Dateline
 * rather than leaving an empty corner. In a product that may not invent data,
 * saying what is missing IS the design.
 */
export type StatChip = "neutral" | "success" | "warning" | "danger";

export interface StatDelta {
  value: string;
  direction: "up" | "down" | "flat";
  tone: "success" | "danger" | "neutral";
}

export interface StatProps {
  label: string;
  value: string | number;
  rank?: "inline" | "section" | "hero";
  currency?: string;
  unit?: string;
  delta?: StatDelta;
  /** Shown instead of a delta when there is genuinely nothing to compare against. */
  deltaWithheld?: string;
  chip?: StatChip;
  icon?: React.ElementType;
  /** Provenance for this figure — what it counts, over what window. */
  dateline?: string;
  /** A short plain-language note under the figure. */
  note?: string;
  href?: string;
  /** Render the link with this component (e.g. next/link). Defaults to <a>. */
  linkComponent?: React.ElementType;
  className?: string;
}

const CHIP_CLASS: Record<StatChip, string> = {
  neutral: "bg-neutral-soft text-ink-2 ring-1 ring-neutral-rule",
  success: "bg-success-soft text-success-ink ring-1 ring-success-rule",
  warning: "bg-warning-soft text-warning-ink ring-1 ring-warning-rule",
  danger: "bg-danger-soft text-danger-ink ring-1 ring-danger-rule",
};

const DELTA_CLASS: Record<StatDelta["tone"], string> = {
  success: "text-success-ink",
  danger: "text-danger-ink",
  neutral: "text-ink-3",
};

export function Stat({
  label,
  value,
  rank = "inline",
  currency,
  unit,
  delta,
  deltaWithheld,
  chip,
  icon: Icon,
  dateline,
  note,
  href,
  linkComponent: LinkComp = "a",
  className,
}: StatProps) {
  const DeltaIcon = delta?.direction === "up" ? TrendingUp : delta?.direction === "down" ? TrendingDown : Minus;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-nested",
                chip ? CHIP_CLASS[chip] : "bg-neutral-soft text-ink-3",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
          <Eyebrow className="truncate">{label}</Eyebrow>
        </div>
        {delta && (
          // ms-auto, not ml-auto. The old primitive shipped a physical property
          // into all three portals and broke every Arabic metric card.
          <span className={cn("u-meta ms-auto inline-flex shrink-0 items-center gap-0.5 font-medium", DELTA_CLASS[delta.tone])}>
            <DeltaIcon className="h-3 w-3" aria-hidden="true" />
            {delta.value}
          </span>
        )}
      </div>

      <div className="mt-1.5">
        <Num value={value} rank={rank} currency={currency} unit={unit} />
      </div>

      {note && <p className="u-meta mt-1 text-ink-2">{note}</p>}
      {dateline && <Dateline className="mt-1">{dateline}</Dateline>}
      {!delta && deltaWithheld && <Dateline className="mt-1">{deltaWithheld}</Dateline>}
    </>
  );

  if (href) {
    return (
      <LinkComp
        href={href}
        data-focus-lift=""
        className={cn(
          "block rounded-nested outline-none transition-colors duration-hover ease-standard hover:bg-ink-1/[0.02]",
          className,
        )}
      >
        {body}
      </LinkComp>
    );
  }

  return <div className={className}>{body}</div>;
}
