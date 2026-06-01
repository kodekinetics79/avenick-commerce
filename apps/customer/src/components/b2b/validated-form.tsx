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
}: {
  action: (state: B2BActionState, formData: FormData) => Promise<B2BActionState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, setState] = React.useState<B2BActionState>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handle(formData: FormData) {
    const result = (await action(state, formData)) ?? {};
    setState(result);
    if (result.ok) formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handle} className={className}>
      {children}
      {state.error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-danger"><AlertCircle className="h-4 w-4 shrink-0" /> {state.error}</p>
      )}
      {state.ok && state.message && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="h-4 w-4 shrink-0" /> {state.message}</p>
      )}
    </form>
  );
}
