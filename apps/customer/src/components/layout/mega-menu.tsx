"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@avenick/utils";
import { Eyebrow, NavItem, Surface } from "@avenick/ui";
import { useDisclosure } from "./disclosure";

/**
 * The mega-menu.
 *
 * Structure, not invention. Every destination in a panel is a real page in this
 * app whose availability is recorded in ops/release/frontend-availability.json,
 * and the panels are grouped by what the pages actually are — sourcing,
 * ordering, company — rather than by categories nobody has data for. Law 1
 * forbids filling a surface with fiction, and a storefront's navigation is the
 * easiest place in a product to break that rule.
 *
 * The hrefs themselves deliberately do NOT live in this file. header.tsx is the
 * registered navigation source that CI checks every destination against, so the
 * data stays there and only its presentation lives here.
 *
 * The panel is rung 4 and OPAQUE, not glass. The header above it already spends
 * one of the portal's blurred surfaces, and a panel that is nothing but body
 * text is precisely the case law 5 names: text never sits on a blur.
 */
export interface MegaMenuLink {
  href: string;
  label: string;
}

export interface MegaMenuColumn {
  title: string;
  links: MegaMenuLink[];
}

export interface MegaMenuProps {
  /** Used for aria-controls; must be unique in the document. */
  id: string;
  /** The section root. The trigger is a real link, so the panel is never the
   *  only way to reach the section — with JavaScript off it still navigates. */
  href: string;
  label: string;
  /** Accessible name for the chevron, e.g. "Shop submenu". */
  menuLabel: string;
  active?: boolean;
  columns: MegaMenuColumn[];
}

export function MegaMenu({ id, href, label, menuLabel, active = false, columns }: MegaMenuProps) {
  const { open, rootProps, triggerProps } = useDisclosure(id, { hover: true });
  const wide = columns.length >= 3;

  return (
    <div className="relative" {...rootProps}>
      <div className="flex items-center">
        {/*
          The link and the chevron are SIBLINGS. Law 5: never an interactive
          element nested inside an anchor — and it also means a pointer user can
          jump straight to /products without waiting for a panel they did not
          ask for.
        */}
        <NavItem
          href={href}
          label={label}
          active={active}
          orientation="horizontal"
          linkComponent={Link}
          className="pe-1.5"
        />
        <button
          {...triggerProps}
          aria-label={menuLabel}
          className="u-focus -ms-1.5 grid h-7 w-6 place-items-center rounded-nested text-ink-3 transition-colors duration-hover ease-standard hover:text-ink-1"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-hover ease-standard",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {/*
        The wrapper, not the panel, is what is positioned. It starts flush at the
        trigger's bottom edge and carries the 12px offset as PADDING, so the
        pointer never crosses a gap that is outside the disclosure root on its
        way down to the panel. With a margin instead, pointerleave fired in that
        gap and the menu closed before the pointer could reach it — the panel was
        effectively unreachable with a mouse.

        It is also mounted only while open, which is what lets `.u-pop`'s
        @starting-style entry run on every open — a starting style only applies
        to an element being inserted, so a permanently mounted node toggled with
        `hidden` would animate once, at page load, behind display:none.
      */}
      {open && (
        <div
          className={cn(
            "absolute start-0 top-full z-layer pt-3",
            // At lg the "For business" trigger sits far enough along the bar that
            // a 46rem panel anchored to it runs past the viewport edge and gives
            // the document a horizontal scrollbar. The wide panel only reaches its
            // full three columns once there is room for them.
            wide
              ? "w-[min(34rem,calc(100vw-2rem))] xl:w-[min(46rem,calc(100vw-2rem))]"
              : "w-[min(30rem,calc(100vw-2rem))]",
          )}
        >
          <Surface rung={4} id={id} className="u-pop w-full p-5">
            <div className={cn("grid gap-x-8 gap-y-5", wide ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-2")}>
              {columns.map((column) => (
                <div key={column.title}>
                  <Eyebrow as="h2" className="mb-2 px-2">
                    {column.title}
                  </Eyebrow>
                  <ul className="space-y-0.5">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="u-focus u-ui block rounded-nested px-2 py-1.5 text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.05] hover:text-ink-1"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}
