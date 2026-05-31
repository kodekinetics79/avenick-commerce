"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { B2BActionState } from "@/lib/b2b";

/**
 * Wraps a B2B create form with inline error/success messaging.
 * Children keep their own layout; the message renders beneath them.
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
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
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
