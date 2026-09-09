"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Field } from "@avenick/ui";
import { cn } from "@avenick/utils";
import { SelectField, TextField } from "@/components/b2b/controls";
import type { B2BActionState } from "@/lib/b2b";

/**
 * What a server action may hand back to this form.
 *
 * `B2BActionState` carries only the flat `error` sentence, and that is all the
 * registration form ever showed — even though /api/auth/register/business has
 * always returned a `fieldErrors` map naming each offending field. An applicant
 * filling in fourteen boxes was told "Password: Password must contain a number.
 * Phone number: Enter the phone in international format" as one run-on line at
 * the bottom of the form and left to work out which box each half belonged to.
 *
 * The map is keyed by the control's `name`, exactly as the endpoint builds it,
 * so a field can find its own message without anything in between translating
 * key to key.
 */
export type ValidatedFormState = B2BActionState & {
  fieldErrors?: Record<string, string>;
};

/**
 * The last submission's per-field messages, read by name.
 *
 * A context rather than props because the fields are composed by a SERVER
 * component: /b2b/register renders its inputs as children of this client form,
 * so nothing in the page can hold the response. Context crosses that boundary
 * — the children slot is rendered inside this component's client tree — which
 * is why the field wrappers below have to be client components and cannot take
 * a function child from the page.
 */
const FieldErrorContext = React.createContext<Record<string, string> | undefined>(undefined);

/**
 * Exported so the field wrappers can be exercised without driving a form
 * submission: this project is on React 18.3, where `<form action={fn}>` is a
 * Next-supplied capability that does not exist in a bare react-dom render.
 */
export function FieldErrorProvider({
  errors,
  children,
}: {
  errors?: Record<string, string>;
  children: React.ReactNode;
}) {
  return <FieldErrorContext.Provider value={errors}>{children}</FieldErrorContext.Provider>;
}

function useFieldError(name: string): string | undefined {
  return React.useContext(FieldErrorContext)?.[name];
}

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
  action: (state: ValidatedFormState, formData: FormData) => Promise<ValidatedFormState>;
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
  const [state, setState] = React.useState<ValidatedFormState>({});
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
      {/* Every <ValidatedTextField> / <ValidatedSelectField> below picks its own
          message out of this, by name. A form that uses plain controls simply
          never reads it and behaves exactly as it did before. */}
      <FieldErrorProvider errors={state.fieldErrors}>{children}</FieldErrorProvider>
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

        It stays even when every field is carrying its own message. A field
        error is only visible if you happen to be looking at that field, and on
        a form this long the submit button can be a screen away from the box
        that failed; this is the one line that is announced on submit and says
        how many there are.
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

/**
 * A labelled text control whose message is ASSOCIATED with it.
 *
 * What this replaces on /b2b/register was a label wrapping its input with no
 * id, no `aria-describedby` and nowhere at all for an error to go. A screen
 * reader could read the label and then had no way to be told the field was
 * rejected, let alone why — the same defect checkout carried until <Field>
 * grew the function child that hands the control its wiring.
 *
 * `{...a11y}` goes on LAST so a call site cannot accidentally shadow the id or
 * the describedby that the label and the message line point at.
 */
export interface ValidatedTextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "id" | "name"> {
  /** The control's `name`, and the key its server message is filed under. */
  name: string;
  label: string;
  /** Shown on the reserved message line until a server message replaces it. */
  hint?: string;
  size?: "sm" | "md";
}

export function ValidatedTextField({ name, label, hint, className, ...props }: ValidatedTextFieldProps) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {(a11y) => (
        <TextField
          name={name}
          className={cn(error && "border-danger-rule", className)}
          {...props}
          {...a11y}
        />
      )}
    </Field>
  );
}

/** The <select> half of the same thing; the options stay the caller's. */
export interface ValidatedSelectFieldProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "id" | "name"> {
  name: string;
  label: string;
  hint?: string;
  size?: "sm" | "md";
}

export function ValidatedSelectField({
  name,
  label,
  hint,
  className,
  children,
  ...props
}: ValidatedSelectFieldProps) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {(a11y) => (
        <SelectField
          name={name}
          className={cn(error && "border-danger-rule", className)}
          {...props}
          {...a11y}
        >
          {children}
        </SelectField>
      )}
    </Field>
  );
}
