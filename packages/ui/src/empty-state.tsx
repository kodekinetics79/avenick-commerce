"use client";

import * as React from "react";
import { cn } from "@avenick/utils";
import { Eyebrow } from "./eyebrow";

/**
 * EmptyState — an editorial blank, not an error screen.
 *
 * The old version put a 64px muted icon tile above an 18px bold line, which
 * reads as something having gone wrong. That matters enormously here: this
 * product may not fill an empty surface with fiction, so its empty surfaces have
 * to read as deliberate. A deliberately blank page in a printed report is calm;
 * a grey tile with a slashed-circle icon is a 500 page.
 *
 * Say precisely WHAT is empty. "No orders yet" is a fact. "Nothing to see here"
 * is filler, and filler is what the hardening programme spent months removing.
 *
 * Every list, table and grid in all three portals must pass one of these.
 */
export interface EmptyStateProps {
  /** Names the state in micro-caps, e.g. "NOTHING RECORDED". */
  eyebrow?: string;
  /** The precise sentence. Preferred over `title`. */
  headline?: string;
  /** Explanation. Preferred over `description`. */
  body?: string;
  /** @deprecated Use `headline`. Kept so existing call sites keep working. */
  title?: string;
  /** @deprecated Use `body`. Kept so existing call sites keep working. */
  description?: string;
  /** A single action. One button, never a row of them. */
  action?: React.ReactNode;
  /** Small inline mark, rendered at text scale rather than in a 64px tile. */
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  eyebrow,
  headline,
  body,
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  const lead = headline ?? title ?? "";
  const explain = body ?? description;

  return (
    <div className={cn("px-6 py-14 text-center", className)}>
      {/* A 2px rule rather than an icon tile: it is the same underrule the section
          heads and table heads use, so an empty surface still belongs to the page. */}
      <div className="mx-auto mb-5 h-0.5 w-10 bg-border-strong" aria-hidden="true" />

      <Eyebrow className="mb-2 flex items-center justify-center gap-1.5">
        {icon}
        {eyebrow ?? "Nothing recorded"}
      </Eyebrow>

      {/* The provenance voice, at h2 size. This sentence is a statement of fact
          about the data, which is exactly what the serif is reserved for. */}
      <p className="u-provenance mx-auto max-w-desc text-h2 text-ink-1">{lead}</p>

      {explain && <p className="u-ui mx-auto mt-2 max-w-desc text-ink-2">{explain}</p>}

      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
