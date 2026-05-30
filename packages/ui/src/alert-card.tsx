"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { cn } from "@manzil/utils";

export type AlertCardType = "info" | "warning" | "error" | "success";

export interface AlertCardProps {
  type?: AlertCardType;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}

const TYPE_CONFIG: Record<AlertCardType, {
  container: string;
  iconBg: string;
  icon: React.ElementType;
  titleColor: string;
  messageColor: string;
  ctaColor: string;
}> = {
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
  const Icon = cfg.icon;

  return (
    <div className={cn("rounded-2xl border p-4 flex items-start gap-3", cfg.container, className)}>
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", cfg.iconBg)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-semibold text-sm", cfg.titleColor)}>{title}</p>
        {message && <p className={cn("text-xs mt-0.5 leading-relaxed", cfg.messageColor)}>{message}</p>}
      </div>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className={cn("text-xs font-semibold shrink-0 underline underline-offset-2 transition-colors", cfg.ctaColor)}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
