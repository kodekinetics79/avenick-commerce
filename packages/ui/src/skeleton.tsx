"use client";

import * as React from "react";
import { cn } from "@manzil/utils";

/** Base shimmer block. Relies on the `.skeleton` utility defined in each app's globals.css. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/** A card-shaped loading placeholder (e.g. metric / content card). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border shadow-card p-4", className)}>
      <Skeleton className="h-8 w-8 rounded-lg mb-3" />
      <Skeleton className="h-6 w-24 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

/** A grid of metric skeletons. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

/** A table-shaped loading placeholder. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-4", c === 0 ? "w-32" : "flex-1 max-w-[120px]")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
