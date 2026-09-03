"use client";

import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * Loading skeletons, shaped like the surfaces they stand in for.
 *
 * The shimmer is the ONLY infinite animation permitted anywhere in the product,
 * because it is a genuine loading indicator. Its highlight used to be a
 * hardcoded rgba(255,255,255,0.35), which is invisible against a dark card; it
 * is a --rim token now, with a separate dark value, and it stops entirely under
 * prefers-reduced-motion (the block is opaque instead of animated).
 *
 * A skeleton must occupy the same box as the thing it replaces, or the page
 * jumps when the data lands. These match the new primitives: SkeletonCellGrid is
 * one hairline-divided panel, not N floating cards.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

/** Stands in for a <Stat>: eyebrow line, then a figure at inline rank. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn("p-4", className)} aria-hidden="true">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  );
}

/**
 * Stands in for a <CellGrid> — ONE panel with hairline dividers. Using N
 * SkeletonCards here and then rendering a CellGrid would make the page visibly
 * reassemble itself when the data arrives.
 */
export function SkeletonCellGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      data-rung={2}
      className={cn(
        // Same gap-px construction as CellGrid, so the loaded state lands in
        // exactly the same box.
        "grid grid-cols-2 gap-px overflow-hidden border border-border bg-hairline lg:grid-cols-4 [&>*]:bg-surface-2",
        className,
      )}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

/** A card-shaped placeholder at rung 2. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div data-rung={2} className={cn("border border-border p-4", className)} aria-hidden="true">
      <Skeleton className="mb-3 h-6 w-6 rounded-nested" />
      <Skeleton className="mb-2 h-6 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

/** A grid of metric skeletons. Kept for existing call sites. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return <SkeletonCellGrid count={count} />;
}

/**
 * Stands in for a <LedgerTable>: a rung-1 well, a 2px head underrule, and rows
 * at the portal's --row-h so nothing shifts vertically when the data lands.
 */
export function SkeletonLedger({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div data-rung={1} className="overflow-hidden border border-border" aria-hidden="true">
      <div className="flex items-center gap-4 border-b-2 border-border-strong px-4 py-2">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className={cn("h-3", c === 0 ? "w-28" : "w-16 flex-1")} />
        ))}
      </div>
      <div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 border-b border-hairline px-4 last:border-b-0"
            style={{ height: "var(--row-h)" }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-28" : "w-16 flex-1")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kept at its original name and signature; now shaped like a LedgerTable. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return <SkeletonLedger rows={rows} cols={cols} />;
}

/** A vertical list of rows, e.g. an inbox or an activity feed. */
export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div data-rung={2} className={cn("overflow-hidden border border-border", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 border-b border-hairline p-4 last:border-b-0">
          <Skeleton className="h-8 w-8 shrink-0 rounded-nested" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="mt-2 h-3 w-3/5" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-pill" />
        </div>
      ))}
    </div>
  );
}
