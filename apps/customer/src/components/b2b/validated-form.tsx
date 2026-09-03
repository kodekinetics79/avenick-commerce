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
      {/*
        The outcome, in the system's own COMMIT gesture rather than as a coloured
        line of text.

        `.u-commit` is the 3px inline-start rule that marks an acted-on row in a
        queue: always present, always 3px, only its colour changes, with a soft
        wash scaled in from the inline start beneath it. Using it here means a
        buyer who has just invited a colleague sees the same mark on the form's
        answer that they see on a row in the approvals queue, rather than
        learning a second visual language for the same event. `.u-pop` is the
        entry, and it is CSS `@starting-style`: no JavaScript, nothing to
        interrupt, and nothing that delays the message being readable.

        role="alert" / role="status" so the outcome of a submit is ANNOUNCED
        rather than only appearing. The ink is the -ink token, not the fill hue,
        which measures about 4:1 at this size on a light ground.

        The message itself is not translated here: it is the SERVER's own reason
        — a validation message naming the field, or the API's own refusal — and
        replacing it with a generic translated line would throw away the only
        actionable part of it.
      */}
      {state.error && (
        <div
          role="alert"
          data-rung={2}
          data-commit="failed"
          className="u-commit u-pop mt-3 flex items-start gap-2 overflow-hidden border-s-[3px] border border-border p-3"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
          <p className="u-ui text-ink-1">{state.error}</p>
        </div>
      )}
      {state.ok && state.message && (
        <div
          role="status"
          data-rung={2}
          data-commit="committed"
          className="u-commit u-pop mt-3 flex items-start gap-2 overflow-hidden border-s-[3px] border border-border p-3"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
          <p className="u-ui text-ink-1">{state.message}</p>
        </div>
      )}
    </form>
  );
}
