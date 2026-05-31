"use client";

import * as React from "react";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { cn } from "@avenick/utils";

interface CurrencyDisplayProps {
  amount: number;
  currency?: SupportedCurrency;
  locale?: "ar" | "en";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showVat?: boolean;
  vatAmount?: number;
}

const SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg font-semibold",
  xl: "text-2xl font-bold",
};

export function CurrencyDisplay({
  amount,
  currency = "AED",
  locale = "en",
  className,
  size = "md",
  showVat,
  vatAmount,
}: CurrencyDisplayProps) {
  const formatted = formatCurrency(amount, currency, locale);

  return (
    <span className={cn(SIZE_CLASSES[size], className)}>
      {formatted}
      {showVat && vatAmount != null && (
        <span className="ms-1 text-xs font-normal text-muted-foreground">
          {locale === "ar" ? "شامل ضريبة" : "incl. VAT"}
        </span>
      )}
    </span>
  );
}
