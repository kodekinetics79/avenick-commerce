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
