/**
 * Button variant classes, deliberately NOT in button.tsx.
 *
 * button.tsx is a "use client" module. Next replaces every export of a client
 * module with a client reference in the server graph, so a server component
 * that imported `buttonVariants` from there got a reference object rather than
 * a function — and calling it failed the build with
 * `TypeError: (0 , d.dc) is not a function`, naming nothing useful. Typecheck
 * cannot see this: the types are identical either side of the boundary.
 *
 * The variants are pure styling logic with no client concern, so they live in
 * their own module that carries no directive and can be called from either
 * side. button.tsx re-exports them, so existing imports keep working.
 */
import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
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
export const SIZE_HEIGHT: Record<string, string> = {
  xs: "calc(var(--control-h-sm) - 4px)",
  sm: "var(--control-h-sm)",
  md: "var(--control-h-md)",
  lg: "var(--control-h-lg)",
  icon: "var(--control-h-md)",
};

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
