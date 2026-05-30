"use client";

import * as React from "react";
import { cn } from "@manzil/utils";

interface LanguageToggleProps {
  locale: "ar" | "en";
  onChange: (locale: "ar" | "en") => void;
  className?: string;
}

export function LanguageToggle({ locale, onChange, className }: LanguageToggleProps) {
  return (
    <div className={cn("flex items-center rounded-lg border border-border overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => onChange("ar")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium transition-colors",
          locale === "ar"
            ? "bg-primary-600 text-white"
            : "bg-background text-muted-foreground hover:bg-muted",
        )}
      >
        عربي
      </button>
      <button
        type="button"
        onClick={() => onChange("en")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium transition-colors",
          locale === "en"
            ? "bg-primary-600 text-white"
            : "bg-background text-muted-foreground hover:bg-muted",
        )}
      >
        EN
      </button>
    </div>
  );
}
