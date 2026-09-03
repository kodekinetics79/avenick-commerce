import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * The native form controls the buyer suite needs.
 *
 * Every form on these pages posts to a server action, so the controls have to
 * be real `<input>` / `<select>` elements with a `name` — Radix's Select is a
 * button plus a portal and carries no form value. What was here before was the
 * same 140-character class string copy-pasted into six pages, each one drawing
 * its own white box with its own ring.
 *
 * `data-rung={1}` is the whole treatment: recessed = input is half of LAW A,
 * and the attribute brings the surface, the inset shadow, the portal radius and
 * `--ring-offset-surface` with it.
 *
 * The focus shadow is written out rather than borrowed from `.u-focus`, and it
 * is written out the same way <Input> writes it: `.u-focus` REPLACES box-shadow,
 * so on an element that gets its recess from `[data-rung="1"]`'s inset shadow it
 * flattens the control the moment it is focused — the one moment the control
 * most needs to read as a place you can type into. Keeping --elev-1 in the stack
 * is what makes these identical to <Input> rather than merely similar to it.
 */
const CONTROL_CLASS = [
  "w-full border border-input bg-surface-1 px-3 text-ui text-ink-1 placeholder:text-ink-3",
  "outline-none focus-visible:shadow-[var(--elev-1),0_0_0_2px_hsl(var(--ring-offset-surface)),0_0_0_4px_hsl(var(--ring))]",
  "transition-[border-color,box-shadow] duration-press ease-standard",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

// `size` is omitted from the native attributes on purpose: on an <input> it
// means visible character width and on a <select> visible rows, neither of
// which this design system uses, and leaving it in makes the intersection with
// our own string union collapse to `never`.
export function SelectField({
  className,
  size = "md",
  children,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: "sm" | "md" }) {
  return (
    <select
      data-rung={1}
      className={cn(CONTROL_CLASS, className)}
      style={{ height: size === "sm" ? "var(--control-h-sm)" : "var(--control-h-md)" }}
      {...props}
    >
      {children}
    </select>
  );
}

export function TextField({
  className,
  size = "md",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "sm" | "md" }) {
  return (
    <input
      data-rung={1}
      className={cn(CONTROL_CLASS, className)}
      style={{ height: size === "sm" ? "var(--control-h-sm)" : "var(--control-h-md)" }}
      {...props}
    />
  );
}
