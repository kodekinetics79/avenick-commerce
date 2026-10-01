/*
 * NO "use client" HERE, deliberately.
 *
 * This component takes `icon` as a COMPONENT (React.ElementType), and server
 * pages pass it one — `icon={Building2}`. A component reference cannot cross
 * the server/client boundary: React tries to serialise it, finds
 * {$$typeof, render, displayName}, and throws "Functions cannot be passed
 * directly to Client Components". The page 500s.
 *
 * That is not hypothetical. The seller's /settings page returned 500 in
 * production for exactly this reason, and the message names neither the prop
 * nor the file, so it reads as a framework failure rather than a directive that
 * should not have been added.
 *
 * There is nothing here that needs the client: no state, no effects, no
 * handlers, no browser API. Without the directive this module is usable from
 * BOTH sides — a client component importing it simply bundles it — so removing
 * it costs nothing and restores the icon prop it advertises.
 */
import * as React from "react";
import { cn } from "@avenick/utils";
import { Eyebrow } from "./eyebrow";
import { Dateline } from "./dateline";

/**
 * SectionHeader.
 *
 * Same props, plus `eyebrow` and `dateline`. The title moves to h3 rank at weight
 * 600 and the count chip becomes a neutral token pill instead of `bg-secondary`.
 *
 * `count` renders whatever the caller passes and nothing else. Do not compute a
 * plausible-looking number here.
 */
export interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Micro-caps label above the title. */
  eyebrow?: string;
  /** Optional leading icon component. */
  icon?: React.ElementType;
  /** Action at the inline end (link or button). */
  action?: React.ReactNode;
  /** Small count shown next to the title. */
  count?: number | string;
  /** Provenance for this section's figures. */
  dateline?: string;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  action,
  count,
  dateline,
  className,
}: SectionHeaderProps) {
  const IconComp = Icon as any;
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-2">
        {IconComp && <IconComp className="text-ink-3 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
        <div className="min-w-0">
          {eyebrow && <Eyebrow className="mb-0.5">{eyebrow}</Eyebrow>}
          <div className="flex items-center gap-2">
            <h2 className="u-h3 text-ink-1 truncate">{title}</h2>
            {count !== undefined && (
              <span className="u-meta rounded-pill bg-neutral-soft text-ink-2 shrink-0 px-2 py-0.5 font-medium">
                {count}
              </span>
            )}
          </div>
          {description && <p className="u-meta text-ink-2">{description}</p>}
          {dateline && <Dateline className="mt-1">{dateline}</Dateline>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
