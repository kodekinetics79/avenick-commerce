import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * NavItem — the shared mark that identifies all three portals as one platform.
 *
 * The current position is RAISED (rung 3, a real cast shadow) while every
 * sibling is flat, and it carries a 2px brass rule at its inline start. Raised
 * current position rather than a coloured bar: it survives both themes, it needs
 * no accent fill, and it is the same gesture in a sidebar and in a horizontal
 * nav — the rule is vertical in the seller and admin sidebars and horizontal in
 * the customer nav, but it is drawn by the same CSS with the same easing.
 *
 * `active` must be computed by the caller from the actual route. Do not guess.
 */
export interface NavItemProps {
  href: string;
  label: string;
  icon?: React.ElementType;
  active?: boolean;
  /** A count, e.g. pending approvals. Only render one the data supports. */
  badge?: React.ReactNode;
  /** Vertical for a sidebar, horizontal for a top nav. */
  orientation?: "vertical" | "horizontal";
  /** Render with this component (e.g. next/link). Defaults to <a>. */
  linkComponent?: React.ElementType;
  /** Collapses the label, leaving an icon-only control. Requires `label` for aria. */
  iconOnly?: boolean;
  className?: string;
}

export function NavItem({
  href,
  label,
  icon: Icon,
  active = false,
  badge,
  orientation = "vertical",
  linkComponent: LinkComp = "a",
  iconOnly = false,
  className,
}: NavItemProps) {
  return (
    <LinkComp
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={iconOnly ? label : undefined}
      data-active={active ? "true" : "false"}
      data-rung={active ? 3 : 0}
      data-focus-lift=""
      className={cn(
        "u-ui relative flex items-center gap-2.5 rounded-nested px-3 outline-none",
        // ps-/pe-, never pl-/pr-: the brass rule sits at the inline start and the
        // padding has to make room for it on the correct side in both scripts.
        active ? "ps-3.5 font-medium text-ink-1" : "text-ink-2 hover:text-ink-1",
        !active && "hover:bg-ink-1/[0.04]",
        "transition-colors duration-hover ease-standard",
                className,
      )}
      style={{ minHeight: orientation === "vertical" ? "var(--control-h-md)" : "var(--control-h-sm)" }}
    >
      {/* The drawn rule. It scales in from the inline start (vertical nav: from
          the top), so it reads as being drawn rather than switched on. */}
      <span
        aria-hidden="true"
        className="u-drawn absolute start-0 inset-y-0 my-auto"
        data-orientation={orientation === "vertical" ? "vertical" : "horizontal"}
        data-on={active ? "true" : "false"}
        style={orientation === "vertical" ? { height: "60%" } : { bottom: 0, top: "auto", width: "100%" }}
      />
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {!iconOnly && <span className="truncate">{label}</span>}
      {badge !== undefined && badge !== null && (
        <span className="u-meta ms-auto shrink-0 rounded-pill bg-neutral-soft px-1.5 font-medium text-ink-2">
          {badge}
        </span>
      )}
    </LinkComp>
  );
}
