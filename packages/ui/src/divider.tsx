import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Divider — the two line weights, made impossible to confuse.
 *
 * `hairline` is a rule INSIDE a surface (between rows of a table, between cells
 * of a CellGrid). `border` is the EDGE of a surface. `strong` is the 2px underrule
 * beneath a table head or a section title. One --border token used to draw all
 * three jobs, which is why dense tables read as boxes inside boxes.
 *
 * `drawn` is the brass signature: a 2px rule that scales itself in from the
 * inline start over 160ms. Active nav, selected tab, link-hover underline,
 * section marker — one gesture used everywhere is what makes a motion system
 * feel designed rather than assembled. It flips direction in Arabic through
 * --origin-inline-start, so no component writes a mirrored rule of its own.
 */
export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "hairline" | "border" | "strong" | "brass";
  orientation?: "horizontal" | "vertical";
  /** Renders the brass drawn rule instead of a static line. */
  drawn?: boolean;
  /** For a drawn rule: whether it is currently drawn in. */
  on?: boolean;
}

export function Divider({
  tone = "hairline",
  orientation = "horizontal",
  drawn = false,
  on = false,
  className,
  ...props
}: DividerProps) {
  if (drawn) {
    return (
      <div
        aria-hidden="true"
        className={cn("u-drawn", className)}
        data-orientation={orientation}
        data-on={on ? "true" : "false"}
        {...props}
      />
    );
  }

  const color =
    tone === "brass"
      ? "bg-brass"
      : tone === "strong"
        ? "bg-border-strong"
        : tone === "border"
          ? "bg-border"
          : "bg-hairline";

  const thickness = tone === "strong" ? (orientation === "horizontal" ? "h-0.5" : "w-0.5") : orientation === "horizontal" ? "h-px" : "w-px";

  return (
    <div
      aria-hidden="true"
      role="separator"
      className={cn(orientation === "horizontal" ? "w-full" : "self-stretch", thickness, color, className)}
      {...props}
    />
  );
}
