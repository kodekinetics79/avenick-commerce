import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FieldWell } from "@avenick/ui";
import { cn } from "@avenick/utils";

/**
 * The two pieces of chrome every ledger screen in this console repeats: the
 * status filter row and the pager. They were hand-written on nine screens with
 * five different idioms — `bg-primary text-white`, `bg-purple-600 text-white`,
 * a pill group, a segmented control — so the same control taught the operator a
 * different lesson on each page.
 *
 * The admin posture allows no primary fill (colour here is state, never
 * decoration), so the current filter is marked the way the active nav item is:
 * it is RAISED off a recessed band while every sibling stays flat. Law A read
 * straight off the page — the thing you can press stands off the ground, the
 * band of context is pressed into it.
 */

export interface FilterTab {
  /** Where the tab goes. Every href is preserved verbatim from the caller. */
  href: string;
  label: string;
  /** Optional count. Omit it rather than show a count that does not match the rows. */
  count?: number;
  active: boolean;
  icon?: React.ElementType;
}

export function FilterTabs({
  tabs,
  label,
  className,
}: {
  tabs: FilterTab[];
  /** Names the group for a screen reader, e.g. "Filter orders by status". */
  label: string;
  className?: string;
}) {
  return (
    <FieldWell
      as="nav"
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-1 p-1", className)}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href + tab.label}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "u-focus inline-flex items-center gap-1.5 whitespace-nowrap rounded-nested px-2.5 py-1 text-meta font-medium",
              "transition-[background-color,color,box-shadow] duration-press ease-standard",
              tab.active
                ? "bg-surface-3 text-ink-1 shadow-elev-2"
                : "text-ink-3 hover:bg-ink-1/[0.04] hover:text-ink-1",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn("fig", tab.active ? "text-ink-2" : "text-ink-3")}>{tab.count}</span>
            )}
          </Link>
        );
      })}
    </FieldWell>
  );
}

/**
 * The pager. Rendered as a LedgerTable footer, so it sits on the table's own
 * hairline rather than inventing a second bordered strip under it.
 */
export function Pager({
  page,
  totalPages,
  hrefFor,
  summary,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  /** What is being paged, stated in full: "1,204 payments". */
  summary: React.ReactNode;
}) {
  const step =
    "u-focus inline-flex items-center gap-1 rounded-nested border border-border bg-surface-3 px-2.5 py-1 text-meta font-medium text-ink-1 shadow-elev-2 transition-[background-color,box-shadow] duration-press ease-standard hover:shadow-elev-3";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span>{summary}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <span className="u-meta text-ink-3">
            Page <span className="fig text-ink-2">{page}</span> of{" "}
            <span className="fig text-ink-2">{totalPages}</span>
          </span>
          {page > 1 && (
            <Link href={hrefFor(page - 1)} className={step}>
              {/* rtl:rotate-180 — a direction-implying icon must flip in Arabic. */}
              <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" /> Previous
            </Link>
          )}
          {page < totalPages && (
            <Link href={hrefFor(page + 1)} className={step}>
              Next <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A recessed control shell for a server-rendered form field. Pair it with
 * `data-rung={1}` on the same element: that attribute is what paints the
 * recessed surface, its radius, its inset shadow and — the part that is easy to
 * forget — the local --ring-offset-surface, without which the inner stop of the
 * two-stop focus ring is drawn against the wrong ground.
 *
 * Inputs are rung 1 for the same reason everywhere: every place you can type is
 * pressed into the page and every place you can click stands off it, so a form
 * is legible before a single label is read.
 */
export const CONTROL =
  "u-focus h-control-md w-full border border-input px-3 text-ui text-ink-1 placeholder:text-ink-3 disabled:cursor-not-allowed disabled:opacity-50";

/** The same control at table-cell scale. */
export const CONTROL_SM =
  "u-focus h-control-sm w-full border border-input px-2 text-meta text-ink-1 placeholder:text-ink-3 disabled:cursor-not-allowed disabled:opacity-50";
