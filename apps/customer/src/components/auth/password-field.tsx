"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@avenick/ui";
import { ValidatedTextField, type ValidatedTextFieldProps } from "@/components/b2b/validated-form";

/**
 * A password field with a show-password control.
 *
 * WHY IT EXISTS. Sign-in and both registration forms had no way to see what was
 * typed, on a password rule that demands an uppercase letter and a number and a
 * sign-in that is rate-limited: a mistyped character costs an attempt against a
 * budget, and a phone keyboard makes that the common case, not the edge.
 *
 * THE CONTROL IS A TOGGLE BUTTON, NOT A LABEL THAT CHANGES. It carries one
 * constant accessible name — "Show password" — and reports its state through
 * `aria-pressed`. Swapping the name to "Hide password" as well would announce
 * the state twice and contradict itself ("Hide password, pressed"), which is
 * the pattern the ARIA practices guide warns against. The eye glyph swaps for
 * sighted readers and is `aria-hidden`.
 *
 * IT SITS ON THE LABEL LINE, AT THE INLINE END — not inside the input. The
 * inside end of a password box is where 1Password, Bitwarden and Chrome draw
 * their own key icons, and a button there sits under, or on top of, the control
 * a password-manager user is actually reaching for. On the label line nothing
 * competes for it, the input keeps its full width, and it needs no change to
 * the shared Input primitive. `end-0` is logical, so it moves to the left in
 * Arabic with the label.
 *
 * AUTOFILL. `name` and `autoComplete` pass straight through, so a manager still
 * recognises the field. On submit the field is put back to type="password"
 * synchronously, before the browser inspects the form for a credential to
 * save: a manager deciding whether to offer "save password" looks at the field
 * type at that moment, and a field left as text can be taken for an ordinary
 * one. The listener sits on the form element, which the event reaches before
 * React's root listener runs the form's own onSubmit.
 *
 * No motion: the glyph swap is the readout, and it lands immediately (LAW D).
 */

const TOGGLE =
  "u-focus absolute end-0 top-[-2px] grid h-6 w-6 place-items-center rounded-nested text-ink-3 " +
  "transition-colors duration-press ease-standard hover:text-ink-1 aria-pressed:text-ink-1";

function useReveal() {
  const wrapper = React.useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = React.useState(false);
  const [controls, setControls] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    const input = wrapper.current?.querySelector("input");
    if (!input) return;
    // Read after mount: the id may be generated inside the field component.
    setControls(input.id || undefined);
    const form = input.form;
    if (!form) return;
    const conceal = () => flushSync(() => setRevealed(false));
    form.addEventListener("submit", conceal);
    return () => form.removeEventListener("submit", conceal);
  }, []);

  return { wrapper, revealed, setRevealed, controls };
}

function RevealToggle({
  label,
  revealed,
  controls,
  onToggle,
}: {
  label: string;
  revealed: boolean;
  controls: string | undefined;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={TOGGLE}
      aria-label={label}
      aria-pressed={revealed}
      aria-controls={controls}
      onClick={onToggle}
    >
      {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

export interface PasswordInputProps extends Omit<InputProps, "type"> {
  /** The toggle's accessible name, from the caller's copy — e.g. "Show password". */
  revealLabel: string;
}

/** The shared <Input> with a show-password toggle. For the identity forms. */
export function PasswordInput({ revealLabel, ...props }: PasswordInputProps) {
  const { wrapper, revealed, setRevealed, controls } = useReveal();
  return (
    <div ref={wrapper} className="relative">
      <Input {...props} type={revealed ? "text" : "password"} />
      <RevealToggle label={revealLabel} revealed={revealed} controls={controls} onToggle={() => setRevealed((r) => !r)} />
    </div>
  );
}

export interface ValidatedPasswordFieldProps extends Omit<ValidatedTextFieldProps, "type"> {
  /** The toggle's accessible name, from the caller's copy — e.g. "Show password". */
  revealLabel: string;
}

/**
 * The buyer suite's validated text field with the same toggle, for
 * /b2b/register — so the field keeps reading its server message by name.
 */
export function ValidatedPasswordField({ revealLabel, ...props }: ValidatedPasswordFieldProps) {
  const { wrapper, revealed, setRevealed, controls } = useReveal();
  return (
    <div ref={wrapper} className="relative">
      <ValidatedTextField {...props} type={revealed ? "text" : "password"} />
      <RevealToggle label={revealLabel} revealed={revealed} controls={controls} onToggle={() => setRevealed((r) => !r)} />
    </div>
  );
}
