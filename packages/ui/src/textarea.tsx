"use client";

import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Textarea — the same recessed rung-1 treatment as Input, so a form reads as one
 * material: everywhere you can type is pressed into the page.
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      data-rung={1}
      className={cn(
        "flex min-h-[88px] w-full resize-y border border-input bg-surface-1 px-3 py-2 text-ui text-ink-1",
        "placeholder:text-ink-3",
        "outline-none focus-visible:shadow-[var(--elev-1),0_0_0_2px_hsl(var(--ring-offset-surface)),0_0_0_4px_hsl(var(--ring))]",
        "transition-[border-color,box-shadow] duration-press ease-standard",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
