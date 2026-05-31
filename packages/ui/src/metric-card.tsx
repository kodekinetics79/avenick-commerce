"use client";

import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@avenick/utils";

export interface MetricCardProps {
  label: string;
  value: string | number;
  /** Optional: "+12%" or "-3 units" shown as a trend indicator */
  trend?: string;
  /** true = green upward arrow, false = red downward arrow */
  trendUp?: boolean;
  /** Sub-label shown below the value */
  sub?: string;
  /** Lucide icon component */
  icon?: React.ElementType;
  /** Tailwind color classes for the icon container, e.g. "bg-blue-100 text-blue-600" */
  iconColor?: string;
  /** When true, applies amber warning styling */
  urgent?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  trend,
  trendUp,
  sub,
  icon: Icon,
  iconColor = "bg-slate-100 text-slate-500",
  urgent = false,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-2xl border shadow-card p-4 transition-shadow hover:shadow-elevated",
        urgent ? "border-warning-border bg-warning-soft" : "border-border",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        {Icon && (
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", iconColor)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        {trend && (
          <span
            className={cn(
              "text-xs font-semibold flex items-center gap-0.5 ml-auto",
              trendUp ? "text-success" : "text-destructive",
            )}
          >
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend}
          </span>
        )}
        {urgent && !trend && (
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse ml-auto" />
        )}
      </div>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
    </div>
  );
}
