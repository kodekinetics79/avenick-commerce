"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { cn } from "@avenick/utils";

export type AlertCardType = "info" | "warning" | "error" | "success";

export interface AlertCardProps {
  type?: AlertCardType;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}

const TYPE_CONFIG: Record<
  AlertCardType,
  {
    container: string;
    iconBg: string;
    icon: React.ElementType;
    titleColor: string;
    messageColor: string;
    ctaColor: string;
  }
> = {
  info: {
    container: "bg-blue-50 border-blue-200",
    iconBg: "bg-blue-100",
    icon: Info,
    titleColor: "text-blue-800",
    messageColor: "text-blue-600",
    ctaColor: "text-blue-700 hover:text-blue-900",
  },
  warning: {
    container: "bg-amber-50 border-amber-200",
    iconBg: "bg-amber-100",
    icon: AlertTriangle,
    titleColor: "text-amber-800",
    messageColor: "text-amber-600",
    ctaColor: "text-amber-700 hover:text-amber-900",
  },
  error: {
    container: "bg-red-50 border-red-200",
    iconBg: "bg-red-100",
    icon: XCircle,
    titleColor: "text-red-800",
    messageColor: "text-red-600",
    ctaColor: "text-red-700 hover:text-red-900",
  },
  success: {
    container: "bg-green-50 border-green-200",
    iconBg: "bg-green-100",
    icon: CheckCircle,
    titleColor: "text-green-800",
    messageColor: "text-green-600",
    ctaColor: "text-green-700 hover:text-green-900",
  },
};

export function AlertCard({
  type = "info",
  title,
  message,
  ctaLabel,
  onCta,
  className,
}: AlertCardProps) {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon as any;

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-4", cfg.container, className)}>
      <div
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", cfg.iconBg)}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", cfg.titleColor)}>{title}</p>
        {message && (
          <p className={cn("mt-0.5 text-xs leading-relaxed", cfg.messageColor)}>{message}</p>
        )}
      </div>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className={cn(
            "shrink-0 text-xs font-semibold underline underline-offset-2 transition-colors",
            cfg.ctaColor,
          )}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
