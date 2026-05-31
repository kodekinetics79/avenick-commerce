"use client";

import * as React from "react";
import { cn } from "@avenick/utils";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Optional leading icon component */
  icon?: React.ElementType;
  /** Right-aligned action (link or button) */
  action?: React.ReactNode;
  /** Small count/badge shown next to the title */
  count?: number | string;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  icon: Icon,
  action,
  count,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-4", className)}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground leading-tight">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {count !== undefined && (
          <span className="text-xs font-semibold bg-secondary text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
            {count}
          </span>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
