"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { cn } from "@avenick/utils";

/**
 * The language control.
 *
 * It used to be two unlabelled text buttons with no indication of which
 * language you were already reading, and clicking the one you were already on
 * cost a full page reload to arrive exactly where you were. It is now a
 * segmented control: the current locale is the raised segment and the pressed
 * state for assistive technology, and selecting it is a no-op.
 *
 * The Arabic label carries lang="ar" so a screen reader in an English document
 * pronounces it rather than spelling it out letter by letter.
 */
const LOCALES = [
  { value: "en", label: "EN", lang: "en" },
  { value: "ar", label: "العربية", lang: "ar" },
] as const;

export interface LocaleToggleProps {
  /** `lg` gives every segment a 44px touch target for the mobile sheet. */
  size?: "sm" | "lg";
  className?: string;
}

export function LocaleToggle({ size = "sm", className }: LocaleToggleProps) {
  const active = useLocale();

  function select(next: string) {
    if (next === active) return;
    // Unchanged from the previous implementation: this cookie is what the root
    // layout reads to choose both the messages and the document direction.
    document.cookie = `AVENICK_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  }

  return (
    <div
      // Recessed, because a segmented control is an input: LAW A.
      data-rung={1}
      className={cn("inline-flex items-center gap-0.5 rounded-pill p-0.5", className)}
    >
      {LOCALES.map((locale) => {
        const current = locale.value === active;
        return (
          <button
            key={locale.value}
            type="button"
            lang={locale.lang}
            aria-pressed={current}
            onClick={() => select(locale.value)}
            className={cn(
              "u-focus rounded-pill transition-colors duration-hover ease-standard",
              size === "lg" ? "u-ui min-h-11 flex-1 px-5" : "u-meta px-2.5 py-1",
              current
                ? "bg-surface-2 font-medium text-ink-1 shadow-elev-2"
                : "text-ink-3 hover:text-ink-1",
            )}
          >
            {locale.label}
          </button>
        );
      })}
    </div>
  );
}
