"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
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
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-nested",
    "font-medium outline-none",
    // Enumerated, never `all`.
    "transition-[background-color,border-color,color,transform,box-shadow] duration-press ease-standard",
    "active:translate-y-[var(--press-y)]",
    "focus-visible:shadow-[0_0_0_2px_hsl(var(--ring-offset-surface)),0_0_0_4px_hsl(var(--ring))]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // The commit action. Rung 3 at rest, rung 4 on hover.
        primary:
          "bg-primary text-primary-foreground shadow-elev-3 hover:bg-primary/90 hover:shadow-elev-4 active:bg-primary/80",
        // Trade / verified / settled actions.
        accent:
          "bg-accent text-accent-foreground shadow-elev-3 hover:bg-accent/90 hover:shadow-elev-4 active:bg-accent/80",
        secondary:
          "bg-surface-3 text-ink-1 border border-border shadow-elev-2 hover:shadow-elev-3 hover:bg-surface-2",
        ghost: "text-ink-2 hover:bg-ink-1/[0.06] hover:text-ink-1",
        outline:
          "border border-border bg-surface-2 text-ink-1 shadow-elev-2 hover:shadow-elev-3",
        destructive:
          "bg-danger text-danger-foreground shadow-elev-3 hover:bg-danger/90 hover:shadow-elev-4 active:bg-danger/80",
        /** Alias of `destructive`, matching the tone vocabulary used elsewhere. */
        danger:
          "bg-danger text-danger-foreground shadow-elev-3 hover:bg-danger/90 hover:shadow-elev-4 active:bg-danger/80",
        // primary-ink, not primary: indigo fill as 11–13px text measures about
        // 4.0:1 on a light ground, and this variant ships on every "View →".
        link: "text-primary-ink underline-offset-4 hover:underline",
      },
      size: {
        xs: "px-2.5 text-micro",
        sm: "px-3 text-meta",
        md: "px-5 text-ui",
        lg: "px-8 text-body",
        icon: "aspect-square p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

// Control heights are tokens rather than classes so a portal retunes every
// button in one line instead of thirty.
const SIZE_HEIGHT: Record<string, string> = {
  xs: "calc(var(--control-h-sm) - 4px)",
  sm: "var(--control-h-sm)",
  md: "var(--control-h-md)",
  lg: "var(--control-h-lg)",
  icon: "var(--control-h-md)",
};

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
