"use client";

import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * A labelled control whose hint or error is ASSOCIATED with it.
 *
 * packages/ui's <Field> reserves the message line (so a failed validation
 * never shifts the form) but gives that line no id, so a screen reader is told
 * a field is invalid without being told why. This keeps Field's exact
 * treatment and adds the one thing it lacks: the message carries an id, and
 * the control is handed `aria-describedby` / `aria-invalid` to point at it. A
 * render-prop rather than cloneElement, so the attributes are visible at the
 * call site. It should fold into <Field> the moment one commit can touch both.
 */
export interface CheckoutFieldA11y {
  id: string;
  "aria-describedby": string;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
}

export interface CheckoutFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
  children: (a11y: CheckoutFieldA11y) => React.ReactNode;
}

export function CheckoutField({ id, label, required = false, hint, error, className, children }: CheckoutFieldProps) {
  const messageId = `${id}-msg`;
  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={id} className="u-ui mb-1.5 block font-medium text-ink-1">
        {label}
        {required && (
          <span className="ms-0.5 text-danger-ink" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": messageId,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {/* min-h keeps the line even when empty, so an error never reflows the form. */}
      <p id={messageId} className={cn("u-meta mt-1 min-h-[18px]", error ? "text-danger-ink" : "text-ink-3")}>
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}
