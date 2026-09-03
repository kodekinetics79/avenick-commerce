"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@avenick/utils";

/**
 * Badge.
 *
 * Every existing variant name is preserved — default / success / warning / error
 * / info / secondary / outline — so the hundreds of call sites keep working. The
 * colours behind them are now token triples (soft wash / rule / ink) with real
 * dark values. `bg-emerald-50 text-emerald-700` and `bg-amber-50 text-amber-700`
 * were cream-on-cream in dark mode; nothing here is a raw palette colour.
 *
 * `info` maps to the accent verdigris rather than blue, because blue and indigo
 * next to each other were doing no semantic work.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-meta font-medium ring-1 transition-colors duration-press ease-standard",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-primary-ink ring-primary/25",
        success: "bg-success-soft text-success-ink ring-success-rule",
        warning: "bg-warning-soft text-warning-ink ring-warning-rule",
        error: "bg-danger-soft text-danger-ink ring-danger-rule",
        danger: "bg-danger-soft text-danger-ink ring-danger-rule",
        info: "bg-accent-soft text-accent-ink ring-accent/30",
        accent: "bg-accent-soft text-accent-ink ring-accent/30",
        neutral: "bg-neutral-soft text-ink-2 ring-neutral-rule",
        secondary: "bg-neutral-soft text-ink-2 ring-neutral-rule",
        outline: "bg-transparent text-ink-2 ring-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
