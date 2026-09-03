"use client";

import * as React from "react";
import { cn } from "@avenick/utils";
import { Stat, type StatChip } from "./stat";

/**
 * MetricCard — kept at its original API so the dozens of existing call sites do
 * not break, but it is now a rung-2 Surface wrapping <Stat>.
 *
 * Three defects it used to ship into all three portals:
 *   · `text-slate-800` hardcoded on the value, which is near-invisible on a dark
 *     ground;
 *   · `ml-auto` on the trend — a physical property inside a shared primitive, so
 *     every Arabic metric card had its trend on the wrong side;
 *   · `animate-pulse` on the urgent dot. That is not a loading indicator, and a
 *     pulsing dot beside a number a supplier reads sixty times a day is fatigue,
 *     not urgency. It is now a static filled ring plus the word.
 *
 * `iconColor` is accepted and IGNORED on purpose. It was how ten raw hues
 * (bg-blue-500, bg-green-500, bg-purple-500 …) got into the seller dashboard —
 * ten colours carrying zero information. Pass `chip` instead: four semantic
 * states, neutral by default.
 *
 * New work should use <Stat> inside a <CellGrid>, which is what stops ten metrics
 * being ten independently bordered floating boxes.
 */
export interface MetricCardProps {
  label: string;
  value: string | number;
  /** Optional: "+12%" or "-3 units" shown as a trend indicator. */
  trend?: string;
  /** true = upward arrow in success ink, false = downward in danger ink. */
  trendUp?: boolean;
  /** Sub-label shown below the value. */
  sub?: string;
  /** Lucide icon component. */
  icon?: React.ElementType;
  /**
   * @deprecated Ignored. Semantic state is `chip`; decorative hue is not a thing
   * this system has. Retained only so existing call sites still type-check.
   */
  iconColor?: string;
  /** When true, applies the warning tone. */
  urgent?: boolean;
  /** Semantic state of the icon chip: neutral | success | warning | danger. */
  chip?: StatChip;
  /** Rank of the figure. A metric that matters should say so with size. */
  rank?: "inline" | "section" | "hero";
  /** Provenance — what this counts and over what window. */
  dateline?: string;
  /** Shown when there is genuinely no prior figure to compare against. */
  deltaWithheld?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  trend,
  trendUp,
  sub,
  icon,
  urgent = false,
  chip,
  rank = "inline",
  dateline,
  deltaWithheld,
  className,
}: MetricCardProps) {
  return (
    <div
      data-rung={2}
      data-tone={urgent ? "warning" : undefined}
      className={cn("border border-border p-4", className)}
    >
      <Stat
        label={label}
        value={value}
        rank={rank}
        icon={icon}
        chip={chip ?? (urgent ? "warning" : undefined)}
        note={sub}
        dateline={dateline}
        deltaWithheld={deltaWithheld}
        delta={
          trend
            ? {
                value: trend,
                direction: trendUp === undefined ? "flat" : trendUp ? "up" : "down",
                tone: trendUp === undefined ? "neutral" : trendUp ? "success" : "danger",
              }
            : undefined
        }
      />
    </div>
  );
}
