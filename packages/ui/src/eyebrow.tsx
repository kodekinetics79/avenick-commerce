import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Eyebrow — the micro/label step.
 *
 * Every `uppercase tracking-widest` string in the product routes through here,
 * which repairs the Arabic damage in exactly one place: Arabic has no case, so
 * `text-transform: uppercase` is a no-op that signals nobody looked, and 0.06em
 * tracking actively pulls the joins between letterforms apart. The .u-micro
 * utility drops both under [dir="rtl"]; an Arabic eyebrow earns its prominence
 * from weight 600 and colour instead.
 */
export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  tone?: "muted" | "accent" | "brass" | "primary";
  as?: React.ElementType;
}

export function Eyebrow({ tone = "muted", as, className, ...props }: EyebrowProps) {
  const Comp: React.ElementType = as ?? "p";
  const color =
    tone === "accent"
      ? "text-accent-ink"
      : tone === "brass"
        ? "text-brass-ink"
        : tone === "primary"
          ? "text-primary-ink"
          : "text-ink-3";
  return <Comp className={cn("u-micro", color, className)} {...props} />;
}
