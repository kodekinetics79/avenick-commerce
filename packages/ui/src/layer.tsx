"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@avenick/utils";

/**
 * Layer — the one modal / drawer / sheet object in the product.
 *
 * The customer cart drawer, the seller bulk-edit sheet and the admin approval
 * modal are all this component with different contents. That is a large part of
 * what makes three portals read as one platform.
 *
 * `side` is LOGICAL: "end" docks to the right-hand edge in English and the
 * left-hand edge in Arabic, and the entry animation multiplies its travel by
 * --dir, so nothing here has a mirrored rule.
 *
 * Rung 5 with --blur-modal, a scrim that blurs and darkens together, focus trap,
 * Esc and scroll lock (all from Radix). The panel is 96% opaque rather than
 * frosted-transparent because body text lives inside it and law 5 does not allow
 * that contrast to depend on whatever happens to be scrolled behind it.
 */
export type LayerSide = "center" | "start" | "end" | "bottom";

export interface LayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: a layer with no accessible name is a trap for screen readers. */
  title: string;
  description?: string;
  /** Hides the title visually while keeping it for assistive technology. */
  hideTitle?: boolean;
  side?: LayerSide;
  size?: "sm" | "md" | "lg" | "full";
  /** Pinned to the bottom of the panel, outside the scrolling body. */
  footer?: React.ReactNode;
  closeLabel?: string;
  children: React.ReactNode;
  className?: string;
}

const CENTER_SIZE: Record<NonNullable<LayerProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  full: "max-w-[min(56rem,calc(100vw-2rem))]",
};

const EDGE_SIZE: Record<NonNullable<LayerProps["size"]>, string> = {
  sm: "w-[min(20rem,100vw)]",
  md: "w-[min(26rem,100vw)]",
  lg: "w-[min(34rem,100vw)]",
  full: "w-screen",
};

export function Layer({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  side = "center",
  size = "md",
  footer,
  closeLabel = "Close",
  children,
  className,
}: LayerProps) {
  const position =
    side === "center"
      ? cn("start-1/2 top-1/2 w-[calc(100vw-2rem)]", CENTER_SIZE[size])
      : side === "bottom"
        ? "inset-x-0 bottom-0 w-full max-h-[85vh]"
        : cn(
            "top-0 bottom-0 max-h-screen",
            side === "end" ? "end-0" : "start-0",
            EDGE_SIZE[size],
          );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="u-layer-scrim" />
        <div className="u-layer-root">
          <DialogPrimitive.Content
            data-side={side}
            data-rung={5}
            data-glass="true"
            data-layer=""
            className={cn(
              "u-layer-panel flex flex-col overflow-hidden",
              // An edge-docked panel keeps square corners against the edge it is
              // docked to, so its radius stays concentric with the viewport.
              side === "center" ? "rounded-lg" : side === "bottom" ? "rounded-t-lg" : "rounded-none",
              position,
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
              <div className="min-w-0">
                <DialogPrimitive.Title className={cn("u-h3 text-ink-1", hideTitle && "sr-only")}>
                  {title}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="u-meta mt-1 text-ink-2">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                aria-label={closeLabel}
                className="u-focus -me-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-nested text-ink-3 transition-colors duration-press ease-standard hover:bg-ink-1/5 hover:text-ink-1"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3">
                {footer}
              </div>
            )}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
