"use client";

import * as React from "react";
import { cn } from "@avenick/utils";
import { Eyebrow } from "./eyebrow";
import { Dateline } from "./dateline";

/**
 * TableShell — the chrome around a hand-written <table>.
 *
 * The API is unchanged (title, toolbar, footer, children) so every existing
 * table keeps rendering, but the chrome is now the ledger idiom: the shell is a
 * rung-1 WELL rather than a rung-2 card, because a table is context you read
 * through, not an object that floats. Its rows are flat inside it.
 *
 * For a new table prefer <LedgerTable>, which owns the row height, the hairline
 * rules, the numeric alignment, the sticky glass head and — crucially — a
 * required empty state.
 */
export interface TableShellProps {
  title?: string;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  /** Provenance for these rows — what they are and over what window. */
  dateline?: string;
  children: React.ReactNode;
  className?: string;
}

export function TableShell({ title, toolbar, footer, dateline, children, className }: TableShellProps) {
  return (
    <div data-rung={1} className={cn("overflow-hidden border border-border", className)}>
      {(title || toolbar || dateline) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            {title && <h2 className="u-h3 text-ink-1">{title}</h2>}
            {dateline && <Dateline className="mt-0.5">{dateline}</Dateline>}
          </div>
          {toolbar && <div className="ms-auto flex items-center gap-2">{toolbar}</div>}
        </div>
      )}
      <div className="overflow-x-auto scrollbar-thin">{children}</div>
      {footer && (
        <div className="u-meta border-t border-hairline px-4 py-2.5 text-ink-3">{footer}</div>
      )}
    </div>
  );
}

/**
 * Header row helper. Micro-caps head cells over a 2px --border-strong underrule —
 * the underrule is what separates a head from a first row without needing a
 * filled background band.
 */
export function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b-2 border-border-strong">
        {columns.map((c) => (
          <th key={c} scope="col" className="whitespace-nowrap px-4 py-2 text-start align-middle">
            <Eyebrow as="span" className="block">
              {c}
            </Eyebrow>
          </th>
        ))}
      </tr>
    </thead>
  );
}
