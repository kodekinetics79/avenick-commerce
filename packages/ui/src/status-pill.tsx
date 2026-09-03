import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * StatusPill — a tokenised surface / rule / ink triple with real dark values.
 *
 * It replaces `bg-emerald-50 text-emerald-700` and `bg-amber-50 text-amber-700`,
 * both of which are cream-on-cream in dark mode today because a light-only wash
 * has no dark counterpart to fall back to.
 *
 * `brass` is reachable only through <TierMark>. Brass has three permitted uses
 * in the whole product — the active-indicator rule, tier marks, verification
 * marks — and a hard 2% viewport-pixel budget. There is deliberately no way to
 * make a brass fill.
 */
export type PillTone = "neutral" | "success" | "warning" | "danger" | "accent" | "primary";

const TONE_CLASS: Record<PillTone | "brass", string> = {
  neutral: "bg-neutral-soft text-ink-2 ring-neutral-rule",
  success: "bg-success-soft text-success-ink ring-success-rule",
  warning: "bg-warning-soft text-warning-ink ring-warning-rule",
  danger: "bg-danger-soft text-danger-ink ring-danger-rule",
  accent: "bg-accent-soft text-accent-ink ring-accent/30",
  primary: "bg-primary-soft text-primary-ink ring-primary/25",
  brass: "bg-transparent text-brass-ink ring-brass/40",
};

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  /** Adds a filled dot. Static, never pulsing: a pulsing dot beside a number
   *  read sixty times a day is fatigue, not urgency. */
  dot?: boolean;
}

export function StatusPill({ tone = "neutral", dot = false, className, children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        "u-meta inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 font-medium ring-1",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-pill bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Internal escape hatch: the only path to a brass pill, used by TierMark. */
export function BrassPill({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "u-micro inline-flex items-center gap-1 rounded-pill px-2 py-0.5 ring-1",
        TONE_CLASS.brass,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
