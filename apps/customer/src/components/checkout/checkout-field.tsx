"use client";

import * as React from "react";
import { Field, type FieldControlA11y } from "@avenick/ui";

/**
 * A labelled control whose hint or error is ASSOCIATED with it.
 *
 * This was a private copy of packages/ui's <Field>, written because that one
 * reserved the message line but gave it no id — so a screen reader was told a
 * field is invalid without being told why. <Field> now carries the id and hands
 * a function child the attributes that point at it, so this is the same
 * component again: the name and the call sites stay, the duplicated markup does
 * not.
 */
export type CheckoutFieldA11y = FieldControlA11y;

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
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error} className={className}>
      {children}
    </Field>
  );
}
