"use client";

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
  const confidenceColor =
    confidence >= 90 ? "bg-green-500" : confidence >= 75 ? "bg-amber-500" : "bg-blue-500";
  const confidenceTextColor =
    confidence >= 90 ? "text-green-600" : confidence >= 75 ? "text-amber-600" : "text-blue-600";

  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-sm transition-shadow", className)}>
      <div className="flex items-start gap-3">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", iconStyle)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-sm text-slate-800">{title}</h3>
            {tag && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tagStyle)}>{tag}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">{description}</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-slate-400">Confidence</span>
              <div className="flex-1 max-w-[100px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    confidenceColor,
                    confidence >= 90 ? "w-[90%]" :
                    confidence >= 80 ? "w-4/5" :
                    confidence >= 75 ? "w-3/4" :
                    confidence >= 60 ? "w-3/5" : "w-1/2",
                  )}
                />
              </div>
              <span className={cn("text-xs font-semibold", confidenceTextColor)}>{confidence}%</span>
            </div>
            {actionLabel && actionHref && (
              <a
                href={actionHref}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap transition-colors"
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
