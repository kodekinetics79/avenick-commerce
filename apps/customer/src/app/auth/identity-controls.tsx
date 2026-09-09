import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * The recessed rung-1 native control, shared by every form on the identity
 * track.
 *
 * Round one duplicated this recipe as a `CONTROL_CLASS` string in three separate
 * files — register, returns and support — each carrying its own copy of the same
 * comment saying it wanted to be a primitive. Three copies of a control is how a
 * fourth one drifts, and drift in the control that sits beside every <Input> is
 * exactly the "the system is not actually a system" tell.
 *
 * It cannot be added to packages/ui from this track, so it lives here, once. It
 * is deliberately its own module rather than part of auth-shell: return-form and
 * the support form need the control but not the shell, and importing the shell
 * would drag MainLayout — header, footer, search — into their bundles.
 *
 * It stays a NATIVE <select> rather than becoming the Radix one: these forms are
 * plain POSTs of controlled state, and a native picker is what a phone keyboard
 * expects. Radius and background come from `[data-rung="1"]`, exactly as
 * <Input> does, so the two controls are the same object at the same depth and
 * the same height — a select that is 2px off an input beside it is the kind of
 * detail that reads as cheap without anyone being able to name why.
 *
 * The focus ring is the .u-focus utility, never a hand-written shadow-[...]
 * value: five rungs and one ring exist, and the first hand-rolled shadow in a
 * page is what lets a sixth appear.
 *
 * No "use client" directive — law 9. These are called from client forms AND
 * from server pages.
 */
export const IDENTITY_CONTROL_CLASS =
  "u-focus w-full border border-input bg-surface-1 px-3 text-ui text-ink-1 outline-none " +
  "transition-[border-color,box-shadow] duration-press ease-standard";

export const IDENTITY_LABEL_CLASS = "u-ui mb-1.5 block font-medium text-ink-1";

export interface IdentitySelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  /** Guidance. Shown only when there is no error to show instead. */
  hint?: string;
  /**
   * The server's refusal for THIS control.
   *
   * It is a separate prop from `hint` deliberately. Routing an error into the
   * hint slot is how the registration form used to show one: the sentence
   * appeared in the muted instruction colour, carried no id, and the control it
   * described said nothing about being invalid — so a screen-reader user was
   * told the field was fine and a sighted user read the refusal as advice.
   */
  error?: string | null;
}

export function IdentitySelect({ label, hint, error, id, className, children, ...props }: IdentitySelectProps) {
  const generated = React.useId();
  const controlId = id ?? generated;
  // One line, one id: the message is either the error or the hint, and the
  // control points at whichever is showing. Reserved either way, so a refusal
  // appearing does not push the rest of the form down the page.
  const messageId = `${controlId}-msg`;
  const message = error ?? hint ?? "";

  return (
    <div className="w-full">
      <label htmlFor={controlId} className={IDENTITY_LABEL_CLASS}>
        {label}
      </label>
      <select
        id={controlId}
        data-rung={1}
        aria-describedby={messageId}
        aria-invalid={error ? true : undefined}
        className={cn(IDENTITY_CONTROL_CLASS, error && "border-danger-edge", className)}
        style={{ height: "var(--control-h-md)" }}
        {...props}
      >
        {children}
      </select>
      <p id={messageId} className={cn("u-meta mt-1 min-h-[18px]", error ? "text-danger-ink" : "text-ink-3")}>
        {message}
      </p>
    </div>
  );
}
