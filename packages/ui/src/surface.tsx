import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Surface — the single most important primitive in the system. Everything with
 * a background composes it.
 *
 * LAW A, the rule that makes the elevation ladder mean something:
 *
 *     raised (3+) = actionable   ·   recessed (1) = context or input   ·   flat (0/2) = content
 *
 * An implementer never has to ask a designer which rung to use; they ask "is
 * this thing clickable?" and look it up. One rung-3 surface per viewport, at
 * most — elevation is scarce or it is noise.
 *
 * This is a Server Component on purpose. A page must never become a client
 * component to get a surface treatment.
 */

export type Rung = 0 | 1 | 2 | 3 | 4 | 5;
export type SurfaceTone = "default" | "success" | "warning" | "danger" | "accent";

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  /** 0 flat · 1 recessed · 2 the card · 3 raised · 4 floating · 5 modal. */
  rung?: Rung;
  /** Adds the hover/focus-within elevation cross-fade. Use only if it is clickable. */
  interactive?: boolean;
  /** Adds the 2px hover lift. Implied by `interactive` unless explicitly false. */
  lift?: boolean;
  /** backdrop-filter. Rungs 4 and 5 only, never nested, budget of 2–3 per viewport. */
  glass?: boolean;
  /** Tints the fill and edge without changing the rung. */
  tone?: SurfaceTone;
  /** Renders as another element or component. Defaults to a div. */
  as?: React.ElementType;
  /** Padding inset in px, used to keep a child's corner concentric with this one. */
  inset?: number;
  /** Enables the pointer specular. Pair with <SpecularSurface> to feed it a position. */
  specular?: boolean;
  /** Promotes the element one rung on :focus-visible and draws the two-stop ring. */
  focusLift?: boolean;
  /** Suppresses the 1px edge, e.g. for a cell inside a CellGrid. */
  bare?: boolean;
}

export const Surface = React.forwardRef<HTMLElement, SurfaceProps>(function Surface(
  {
    rung = 2,
    interactive = false,
    lift,
    glass = false,
    tone = "default",
    as,
    inset,
    specular = false,
    focusLift = false,
    bare = false,
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  // Fail loudly in development rather than shipping a milky page. Blur sprayed
  // onto rung 2 is the number one way this system ships badly: the moment every
  // card is blurred, blur stops meaning "floating" and becomes texture.
  if (process.env.NODE_ENV !== "production" && glass && rung < 4) {
    throw new Error(
      `<Surface glass> requires rung 4 or 5 (got ${rung}). backdrop-filter marks a floating layer — a sticky bar, a dropdown, a drawer, a modal. It is not a card treatment.`,
    );
  }

  const Comp: React.ElementType = as ?? "div";
  const shouldLift = lift ?? interactive;

  return (
    <Comp
      ref={ref}
      data-rung={rung}
      data-interactive={interactive ? "" : undefined}
      data-lift={shouldLift ? "" : undefined}
      data-glass={glass ? "true" : undefined}
      data-tone={tone !== "default" ? tone : undefined}
      data-specular={specular ? "" : undefined}
      data-focus-lift={focusLift ? "" : undefined}
      className={cn(
        // The 1px edge is drawn here rather than in the shadow so a toned
        // surface can recolour it. Rung 0 has no edge: it is content, not an
        // object.
        !bare && rung > 0 && !glass && "border border-border",
        className,
      )}
      style={inset !== undefined ? ({ ...style, ["--inset" as string]: `${inset}px` } as React.CSSProperties) : style}
      {...props}
    >
      {children}
    </Comp>
  );
});

/**
 * FieldWell — a rung-1 recessed surface. This exists as a component rather than
 * a convention so that "recessed = context or input" is something a team uses
 * rather than something a team remembers.
 *
 * It also re-declares --ring-offset-surface, which is what keeps the inner stop
 * of the two-stop focus ring matching the ground it is actually drawn on.
 */
export interface FieldWellProps extends Omit<SurfaceProps, "rung" | "glass"> {
  /** Applies the standard 16px block padding. */
  padded?: boolean;
}

export const FieldWell = React.forwardRef<HTMLElement, FieldWellProps>(function FieldWell(
  { padded = false, className, ...props },
  ref,
) {
  return <Surface ref={ref} rung={1} className={cn(padded && "p-4", className)} {...props} />;
});
