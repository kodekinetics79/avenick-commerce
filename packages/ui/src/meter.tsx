import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Meter / Bar — one element, scaled on X.
 *
 * This replaces the seller dashboard's hand-rolled ten-segment performance meter
 * and the admin dashboard's twenty-div Bars: thirty nodes, each carrying a raw
 * bg-green-500 / bg-yellow-500 / bg-red-500, become one node and a token.
 *
 * The track is recessed (rung 1) and the fill is raised, so the reading is
 * carried by DEPTH rather than by a traffic light the supplier sees sixty times
 * a day. Because the fill is a transform with its origin at the inline start, it
 * is correct in Arabic by construction, it composites instead of repainting, and
 * the number printed beside it never moves.
 */
export type MeterTone = "primary" | "success" | "warning" | "danger" | "accent" | "neutral";

const TONE_VAR: Record<MeterTone, string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  accent: "var(--accent)",
  neutral: "var(--border-strong)",
};

export interface MeterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "role"> {
  value: number;
  max?: number;
  tone?: MeterTone;
  /** Track thickness. Defaults to 6px. */
  size?: "sm" | "md" | "lg";
  /** Accessible name. Required whenever the meter is not adjacent to its own label. */
  label?: string;
  /** Stagger index when several meters mount together, e.g. down a funnel. */
  index?: number;
}

export function Meter({
  value,
  max = 100,
  tone = "primary",
  size = "md",
  label,
  index = 0,
  className,
  style,
  ...props
}: MeterProps) {
  const safeMax = max <= 0 ? 1 : max;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const height = size === "sm" ? "h-1" : size === "lg" ? "h-3" : "h-1.5";

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label}
      className={cn("u-meter-track w-full", height, className)}
      style={style}
      {...props}
    >
      <span
        className="u-meter-fill"
        style={
          {
            ["--meter-value" as string]: `${ratio}`,
            ["--meter-tone" as string]: TONE_VAR[tone],
            transitionDelay: index ? `calc(${index} * 60ms)` : undefined,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

/** Alias kept so a caller can say Bar where a bar reads better than a meter. */
export const Bar = Meter;
export type BarProps = MeterProps;
