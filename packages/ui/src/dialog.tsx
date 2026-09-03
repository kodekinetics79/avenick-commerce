"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@avenick/utils";

/**
 * Dialog — the Radix-composed API, kept intact for existing call sites.
 *
 * It now wears the Layer material: a scrim that blurs and darkens together, a
 * rung-5 panel that arrives on Z from behind rather than sliding, and the light
 * seam on its top edge. The `animate-in`/`fade-in-0`/`zoom-in-95` classes it
 * used before came from tailwindcss-animate, which is not in this project's
 * plugin list — so the old dialog had no animation at all, it just appeared.
 *
 * For NEW work prefer <Layer>: one component covers the modal, the drawer and
 * the bottom sheet, and its `side` is logical so it is correct in Arabic.
 */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    // hsl(var(--scrim)) rather than bg-black/60: a hue-matched scrim over a warm
    // page does not read as soot, and it has a distinct dark-mode value.
    className={cn("u-layer-scrim", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-side="center"
      data-rung={5}
      data-glass="true"
      data-layer=""
      // start-1/2, not left-1/2: the centring translate has to mirror in Arabic
      // or the panel lands off-centre.
      className={cn(
        "u-layer-panel start-1/2 top-1/2 grid w-[calc(100vw-2rem)] max-w-lg gap-4 rounded-lg p-6",
        className,
      )}
      {...props}
    >
      {children}
      <DialogClose className="u-focus absolute end-4 top-4 grid h-8 w-8 place-items-center rounded-nested text-ink-3 transition-colors duration-press ease-standard hover:bg-ink-1/5 hover:text-ink-1 disabled:pointer-events-none">
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-start", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("u-h3 text-ink-1", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("u-ui text-ink-2", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
