"use client";

import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Input.
 *
 * Same API. What changed: the control is now a RECESSED rung-1 surface rather
 * than a bordered white box on a white page. Recessed = input is half of law A,
 * and it is the half that makes a form legible at a glance — every place you can
 * type is pressed into the page, every place you can click stands off it.
 *
 * The focus ring is the two-stop ring, whose inner stop reads
 * --ring-offset-surface, so it stays correct when the field sits inside another
 * well or on a glass bar.
 *
 * The error line's space is reserved, so a failed validation never pushes the
 * rest of the form down the page.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, hint, startIcon, endIcon, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const describedBy = error || hint ? `${inputId}-msg` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="u-ui mb-1.5 block font-medium text-ink-1">
            {label}
          </label>
        )}
        <div className="relative">
          {startIcon && (
            <div className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3">
              {startIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            data-rung={1}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "w-full border border-input bg-surface-1 px-3 text-ui text-ink-1",
              "placeholder:text-ink-3",
              "outline-none focus-visible:shadow-[var(--elev-1),0_0_0_2px_hsl(var(--ring-offset-surface)),0_0_0_4px_hsl(var(--ring))]",
              "transition-[border-color,box-shadow] duration-press ease-standard",
              "disabled:cursor-not-allowed disabled:opacity-50",
              startIcon && "ps-10",
              endIcon && "pe-10",
              error && "border-danger-rule",
              className,
            )}
            style={{ height: "var(--control-h-md)" }}
            {...props}
          />
          {endIcon && (
            <div className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-3">{endIcon}</div>
          )}
        </div>
        {(error || hint) && (
          <p id={describedBy} className={cn("u-meta mt-1", error ? "text-danger-ink" : "text-ink-3")}>
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
