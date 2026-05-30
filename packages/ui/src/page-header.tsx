"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@manzil/utils";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  /** Right-aligned action buttons / controls */
  actions?: React.ReactNode;
  /** Optional eyebrow label above the title */
  eyebrow?: string;
  /** Render breadcrumb links with this component (e.g. Next Link). Defaults to <a>. */
  linkComponent?: React.ElementType;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  eyebrow,
  linkComponent: LinkComp = "a",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          {breadcrumbs.map((bc, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <React.Fragment key={`${bc.label}-${i}`}>
                {bc.href && !isLast ? (
                  <LinkComp href={bc.href} className="hover:text-foreground transition-colors">
                    {bc.label}
                  </LinkComp>
                ) : (
                  <span className={isLast ? "text-foreground font-medium" : ""}>{bc.label}</span>
                )}
                {!isLast && <ChevronRight className="h-3 w-3 shrink-0" />}
              </React.Fragment>
            );
          })}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">{eyebrow}</p>
          )}
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
