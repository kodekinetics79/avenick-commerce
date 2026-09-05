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
 *
 * THE MESSAGE IS ASSOCIATED WITH THE CONTROL. The hint/error line carries an
 * id, and a function child is handed the attributes that point at it. Without
 * that, a screen reader announces a field as invalid and never says why: the
 * error is a paragraph sitting next to the input, related to it only visually.
 * Checkout had to keep a private copy of this component for exactly that
 * reason.
 *
 *   <Field id="ck-line1" label="Address" error={err}>
 *     {(a11y) => <Input {...a11y} value={value} onChange={...} />}
 *   </Field>
 *
 * A plain element child still works and still gets the reserved line, the
 * label and the required mark — it simply is not wired, because nothing here
 * can know which of an arbitrary subtree's elements is the control. Passing
 * `htmlFor` keeps the label's own association in that case.
 */
/** What a function child receives: spread it onto the control, whole. */
export interface FieldControlA11y {
  id: string;
  "aria-describedby": string;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
}

export interface FieldProps {
  label: string;
  /**
   * The control's id. Also the label's `htmlFor` and the stem of the message
   * id. Generated when omitted, so the wiring works either way.
   */
  id?: string;
  /** Legacy alias for `id`, kept for the call sites that pass only this. */
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /** Visually hides the label while keeping it for assistive technology. */
  hideLabel?: boolean;
  children: React.ReactNode | ((a11y: FieldControlA11y) => React.ReactNode);
  className?: string;
}

export function Field({
  label,
  id,
  htmlFor,
  hint,
  error,
  required = false,
  hideLabel = false,
  children,
  className,
}: FieldProps) {
  // useId only when the call site gave neither, so a server-rendered id stays
  // stable and an explicitly passed one is never overridden.
  const generated = React.useId();
  const controlId = id ?? htmlFor ?? generated;
  const messageId = `${controlId}-msg`;

  return (
    <div className={cn("w-full", className)}>
      <label
        htmlFor={controlId}
        className={cn("u-ui mb-1.5 block font-medium text-ink-1", hideLabel && "sr-only")}
      >
        {label}
        {required && (
          <span className="ms-0.5 text-danger-ink" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {typeof children === "function"
        ? children({
            id: controlId,
            "aria-describedby": messageId,
            "aria-invalid": error ? true : undefined,
            "aria-required": required ? true : undefined,
          })
        : children}
      {/* min-h keeps the line even when empty. */}
      <p id={messageId} className={cn("u-meta mt-1 min-h-[18px]", error ? "text-danger-ink" : "text-ink-3")}>
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}
