"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@avenick/utils";
import { Eyebrow } from "./eyebrow";
import { Dateline } from "./dateline";

/**
 * PageHeader.
 *
 * Same props as before, plus `dateline`. What changed is the scale it enforces:
 * the title was `text-2xl font-bold tracking-tight` and is now h1 rank at weight
 * 600, sitting on a --border-strong underrule. Enforcing it here is the point —
 * it means `text-2xl font-extrabold tracking-tighter` cannot be hand-written on
 * a page again and quietly become a fourth heading style.
 *
 * The breadcrumb chevron flips in Arabic. A chevron that points the wrong way is
 * the single most common RTL tell.
 */
export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  /** Actions, at the inline end. */
  actions?: React.ReactNode;
  /** Optional eyebrow label above the title. */
  eyebrow?: string;
  /** Provenance for the whole page — what this data is, over what window. */
  dateline?: string;
  /** Render breadcrumb links with this component (e.g. next/link). Defaults to <a>. */
  linkComponent?: React.ElementType;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  eyebrow,
  dateline,
  linkComponent: LinkComp = "a",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-block border-b border-border-strong pb-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="u-meta mb-2 flex items-center gap-1.5 text-ink-3">
          {breadcrumbs.map((bc, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <React.Fragment key={`${bc.label}-${i}`}>
                {bc.href && !isLast ? (
                  <LinkComp
                    href={bc.href}
                    className="u-focus rounded-nested transition-colors duration-press ease-standard hover:text-ink-1"
                  >
                    {bc.label}
                  </LinkComp>
                ) : (
                  <span className={isLast ? "font-medium text-ink-1" : ""}>{bc.label}</span>
                )}
                {/* rtl:rotate-180 — a direction-implying icon must flip. */}
                {!isLast && <ChevronRight className="h-3 w-3 shrink-0 rtl:rotate-180" aria-hidden="true" />}
              </React.Fragment>
            );
          })}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
          <h1 className="u-h1 text-ink-1">{title}</h1>
          {description && <p className="u-body mt-1 max-w-prose text-ink-2">{description}</p>}
          {dateline && <Dateline className="mt-1.5">{dateline}</Dateline>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
