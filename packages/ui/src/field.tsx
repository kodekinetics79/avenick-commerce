import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Field — label, control, hint and error as one block on the 8px grid.
 *
 * The error line's space is RESERVED whether or not there is an error, so a
 * failed validation never shifts the rest of the form down the page. That is the
 * whole reason this exists as a primitive rather than as three divs.
 *
 * The control itself is expected to be a rung-1 recessed surface — recessed
 * means "context or input", and an input is the canonical recessed thing.
 */
export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Visually hides the label while keeping it for assistive technology. */
  hideLabel?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  hideLabel = false,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("w-full", className)}>
      <label
        htmlFor={htmlFor}
        className={cn("u-ui mb-1.5 block font-medium text-ink-1", hideLabel && "sr-only")}
      >
        {label}
        {required && (
          <span className="ms-0.5 text-danger-ink" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {/* min-h keeps the line even when empty. */}
      <p className={cn("u-meta mt-1 min-h-[18px]", error ? "text-danger-ink" : "text-ink-3")}>
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}
