"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@avenick/utils";

interface HijriDateProps {
  date: Date | string;
  locale?: "ar" | "en";
  className?: string;
  showGregorian?: boolean;
}

function toHijri(date: Date): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return format(date, "dd/MM/yyyy");
  }
}

export function HijriDate({ date, locale = "en", className, showGregorian = true }: HijriDateProps) {
  const d = typeof date === "string" ? new Date(date) : date;
  const hijri = toHijri(d);
  const gregorian = format(d, locale === "ar" ? "d MMMM yyyy" : "MMM d, yyyy");

  if (locale === "ar") {
    return (
      <span className={cn("inline-flex flex-col gap-0.5", className)} title={gregorian}>
        <span className="text-sm">{hijri}</span>
        {showGregorian && <span className="text-xs text-muted-foreground">{gregorian}</span>}
      </span>
    );
  }

  return (
    <span className={cn("cursor-default", className)} title={hijri}>
      {gregorian}
    </span>
  );
}
