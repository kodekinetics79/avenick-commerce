"use client";

import * as React from "react";
import { cn } from "@manzil/utils";

/**
 * TableShell — consistent enterprise wrapper for data tables.
 * Provides the card chrome, optional header/toolbar, horizontal scroll,
 * and footer so every table across the platform looks identical.
 *
 * Usage:
 *   <TableShell title="Orders" toolbar={<Filters/>} footer={<p>…</p>}>
 *     <table className="w-full text-sm">…</table>
 *   </TableShell>
 */
export interface TableShellProps {
  title?: string;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function TableShell({ title, toolbar, footer, children, className }: TableShellProps) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border shadow-card overflow-hidden", className)}>
      {(title || toolbar) && (
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          {title && <h2 className="font-semibold text-foreground">{title}</h2>}
          {toolbar && <div className="flex items-center gap-2 ms-auto">{toolbar}</div>}
        </div>
      )}
      <div className="overflow-x-auto scrollbar-thin">{children}</div>
      {footer && <div className="px-5 py-3 border-t border-border bg-secondary/40 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** Header row helper for consistent table head styling. */
export function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead className="bg-secondary/50 border-b border-border">
      <tr>
        {columns.map((c) => (
          <th key={c} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}
