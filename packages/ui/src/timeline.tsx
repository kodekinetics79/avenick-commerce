/*
 * NO "use client" HERE, deliberately.
 *
 * This component takes `icon` as a COMPONENT (React.ElementType), and server
 * pages pass it one — `icon={Building2}`. A component reference cannot cross
 * the server/client boundary: React tries to serialise it, finds
 * {$$typeof, render, displayName}, and throws "Functions cannot be passed
 * directly to Client Components". The page 500s.
 *
 * That is not hypothetical. The seller's /settings page returned 500 in
 * production for exactly this reason, and the message names neither the prop
 * nor the file, so it reads as a framework failure rather than a directive that
 * should not have been added.
 *
 * There is nothing here that needs the client: no state, no effects, no
 * handlers, no browser API. Without the directive this module is usable from
 * BOTH sides — a client component importing it simply bundles it — so removing
 * it costs nothing and restores the icon prop it advertises.
 */
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@avenick/utils";

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
  currentLabel?: string;
}

export function Timeline({ steps, className, currentLabel = "Current" }: TimelineProps) {
  return (
    <div className={cn("", className)}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const Icon = step.icon as any;
        const future = !step.done && !step.current;
        return (
          <div key={`${step.label}-${idx}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "duration-press ease-standard flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,box-shadow]",
                  step.done && "bg-success text-success-foreground",
                  step.current && "bg-primary text-primary-foreground ring-primary/15 ring-4",
                  future && "bg-surface-1 text-ink-3",
                )}
              >
                {Icon ? (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                ) : step.done ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current opacity-60" aria-hidden="true" />
                )}
              </div>
              {!isLast && (
                <div
                  className={cn("my-0.5 h-10 w-0.5", step.done ? "bg-success/40" : "bg-border")}
                />
              )}
            </div>
            <div className={cn("flex-1", isLast ? "pb-0" : "pb-8")}>
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    future ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {step.label}
                </p>
                {step.current && (
                  <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    {currentLabel}
                  </span>
                )}
              </div>
              {step.description && (
                <p className={cn("mt-0.5 text-xs", future ? "text-ink-3" : "text-ink-2")}>
                  {step.description}
                </p>
              )}
              {step.timestamp && <p className="text-ink-3 mt-0.5 text-xs">{step.timestamp}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
