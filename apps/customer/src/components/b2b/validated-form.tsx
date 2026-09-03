"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { B2BActionState } from "@/lib/b2b";

/**
 * Wraps a create form with inline error/success messaging.
 *
 * Note: this project runs React 18.3, where `useActionState`/`useFormState`
 * aren't available at runtime, so we drive the server action manually via a
 * client form action + useState (still progressive-friendly with JS on).
 */
export function ValidatedForm({
  action,
  children,
  className,
  rung,
}: {
  action: (state: B2BActionState, formData: FormData) => Promise<B2BActionState>;
  children: React.ReactNode;
  className?: string;
  /**
   * Renders the form itself as a surface at this rung. A form is the canonical
   * RECESSED thing (rung 1) in the design system, and putting the attribute on
   * the <form> rather than on a wrapper keeps the outcome messages below inside
   * the same object as the fields that produced them.
   */
  rung?: 0 | 1 | 2;
}) {
  const [state, setState] = React.useState<B2BActionState>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handle(formData: FormData) {
    const result = (await action(state, formData)) ?? {};
    setState(result);
    if (result.ok) formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      action={handle}
      data-rung={rung}
      className={rung !== undefined && rung > 0 ? `border border-border ${className ?? ""}` : className}
    >
      {children}
      {/* role="status" so the outcome of a submit is announced rather than only
          appearing; -ink rather than the fill hue, which measures about 4:1 at
          this size on a light ground. */}
      {state.error && (
        <p role="alert" className="u-ui mt-3 flex items-center gap-1.5 text-danger-ink">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="u-ui mt-3 flex items-center gap-1.5 text-success-ink">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> {state.message}
        </p>
      )}
    </form>
  );
}
