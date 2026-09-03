"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants, SIZE_HEIGHT } from "./button-variants";
import { cn } from "@avenick/utils";

/**
 * Button.
 *
 * Every variant and size that existed still exists, so no call site breaks. What
 * changed underneath:
 *
 *   · `transition-all` is gone. It animated layout properties on every frame of
 *     every hover in the product. Each transition now enumerates its properties.
 *   · `active:scale-[0.98]` is gone. Scaling a button scales its label, which
 *     momentarily blurs the text. The press is a sub-pixel translateY landing in
 *     90ms — under the 100ms threshold where a press stops feeling connected to
 *     the finger.
 *   · `hover:shadow-glow-sm` is gone. On a near-black ground an indigo halo reads
 *     as a gaming peripheral. Emphasis comes from the rung and the light seam.
 *   · Heights come from the portal's --control-h-* tokens, so the same component
 *     is 46px on the storefront and 32px in the console.
 *   · The focus ring is two-stop, so it survives on glass and on any rung.
 *
 * Budget: one primary FILL per view, plus the page's single call to action.
 * Links, eyebrows and icon chips use the ink ramp or --primary-ink instead.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const height = SIZE_HEIGHT[size ?? "md"];
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        style={{ height, ...style }}
        {...props}
      >
        {loading ? (
          <>
            {/* A spinner is a genuine loading indicator, which is the only thing
                in this product allowed to animate forever. */}
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {children}
          </>
        ) : children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
