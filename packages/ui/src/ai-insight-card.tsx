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
import { ArrowRight } from "lucide-react";
import { cn } from "@avenick/utils";

export interface AIInsightCardProps {
  /** Lucide icon component */
  icon: React.ElementType;
  /** Tailwind classes for the icon container bg and icon color, e.g. "bg-blue-100 text-blue-600" */
  iconStyle?: string;
  title: string;
  description: string;
  /** 0-100 confidence percentage */
  confidence: number;
  /** Label for the action button */
  actionLabel?: string;
  /** href to navigate to on action click */
  actionHref?: string;
  /** Optional tag label */
  tag?: string;
  /** Tailwind classes for the tag */
  tagStyle?: string;
  className?: string;
}

export function AIInsightCard({
  icon: Icon,
  iconStyle = "bg-blue-100 text-blue-600",
  title,
  description,
  confidence,
  actionLabel,
  actionHref,
  tag,
  tagStyle = "bg-slate-100 text-slate-500",
  className,
}: AIInsightCardProps) {
  const IconComp = Icon as any;
  const confidenceColor =
    confidence >= 90 ? "bg-green-500" : confidence >= 75 ? "bg-amber-500" : "bg-blue-500";
  const confidenceTextColor =
    confidence >= 90 ? "text-green-600" : confidence >= 75 ? "text-amber-600" : "text-blue-600";

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconStyle)}
        >
          <IconComp className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            {tag && (
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tagStyle)}>
                {tag}
              </span>
            )}
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">{description}</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <span className="text-xs text-slate-400">Confidence</span>
              <div className="h-1.5 max-w-[100px] flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    confidenceColor,
                    confidence >= 90
                      ? "w-[90%]"
                      : confidence >= 80
                        ? "w-4/5"
                        : confidence >= 75
                          ? "w-3/4"
                          : confidence >= 60
                            ? "w-3/5"
                            : "w-1/2",
                  )}
                />
              </div>
              <span className={cn("text-xs font-semibold", confidenceTextColor)}>
                {confidence}%
              </span>
            </div>
            {actionLabel && actionHref && (
              <a
                href={actionHref}
                className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-blue-600 transition-colors hover:text-blue-800"
              >
                {actionLabel} <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
