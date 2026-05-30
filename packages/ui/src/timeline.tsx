"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@manzil/utils";

export interface TimelineStep {
  label: string;
  description?: string;
  timestamp?: string;
  /** completed step (green, checked) */
  done?: boolean;
  /** the active/current step (ring highlight) */
  current?: boolean;
  /** optional custom icon */
  icon?: React.ElementType;
}

export interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function Timeline({ steps, className }: TimelineProps) {
  return (
    <div className={cn("", className)}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const Icon = step.icon;
        const future = !step.done && !step.current;
        return (
          <div key={`${step.label}-${idx}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all",
                  step.done && "bg-success text-white",
                  step.current && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                  future && "bg-secondary text-muted-foreground",
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : step.done ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current opacity-60" />}
              </div>
              {!isLast && (
                <div className={cn("w-0.5 h-10 my-0.5", step.done ? "bg-success/40" : "bg-border")} />
              )}
            </div>
            <div className={cn("flex-1", isLast ? "pb-0" : "pb-8")}>
              <div className="flex items-center gap-2">
                <p className={cn("font-semibold text-sm", future ? "text-muted-foreground" : "text-foreground")}>{step.label}</p>
                {step.current && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">Current</span>
                )}
              </div>
              {step.description && <p className={cn("text-xs mt-0.5", future ? "text-muted-foreground/60" : "text-muted-foreground")}>{step.description}</p>}
              {step.timestamp && <p className="text-xs text-muted-foreground mt-0.5">{step.timestamp}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
