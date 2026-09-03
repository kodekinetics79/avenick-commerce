"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * The one disclosure behaviour shared by the header's mega-menus and its
 * account menu.
 *
 * Both used to be <details>/<summary>. That element cannot close on Escape, it
 * cannot close when the pointer leaves it, and — the reason this hook exists —
 * it stays open across a client-side navigation, so every panel in the old
 * header was still hanging over the page it had just taken you to.
 *
 * Hover-to-open is attached ONLY where a hover state actually exists: the media
 * query is read once on mount and the handlers are simply absent on a touch
 * screen rather than attached and then ignored.
 */
export interface DisclosureOptions {
  /** Open on pointer enter. Ignored on coarse pointers. */
  hover?: boolean;
}

export function useDisclosure(panelId: string, { hover = false }: DisclosureOptions = {}) {
  const [open, setOpen] = React.useState(false);
  const [canHover, setCanHover] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();

  React.useEffect(() => {
    if (!hover) return;
    setCanHover(window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false);
  }, [hover]);

  // The click that navigates may come from anywhere inside the panel, so the
  // route itself is the only reliable signal that the panel's job is done.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Focus returns to the control that opened the panel; otherwise a keyboard
      // user is left standing on an element that has just been hidden.
      triggerRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const rootProps = {
    ref: rootRef,
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      // Tabbing past the last link in the panel closes it. A null relatedTarget
      // means focus left the document entirely, which is not our business.
      const next = event.relatedTarget as Node | null;
      if (next && !event.currentTarget.contains(next)) setOpen(false);
    },
    // undefined rather than a no-op: React attaches no listener at all.
    onPointerEnter: canHover ? () => setOpen(true) : undefined,
    onPointerLeave: canHover ? () => setOpen(false) : undefined,
  };

  const triggerProps = {
    ref: triggerRef,
    type: "button" as const,
    "aria-expanded": open,
    // aria-controls must reference an element that is actually in the document.
    // The panels below unmount when closed — which is also what lets their entry
    // animation play on every open rather than once, at page load — so the
    // association is only advertised while the panel exists.
    "aria-controls": open ? panelId : undefined,
    onClick: () => setOpen((value) => !value),
  };

  return { open, setOpen, rootProps, triggerProps };
}
