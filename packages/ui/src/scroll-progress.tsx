import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * ScrollProgress — the brass reading hairline across the top of the viewport.
 *
 * Zero JavaScript and zero scroll listeners: it is a scaleX on a scroll-driven
 * CSS timeline, which runs on the compositor. transform-origin is the
 * --origin-inline-start token, so it draws from the right in Arabic for free,
 * and it is the SAME brass rule as the active nav, the seal, the certificate's
 * top edge and the ladder's active band. One gesture in different postures is
 * what makes a system read as designed rather than assembled.
 *
 * Where scroll timelines are unsupported it stays at scaleX(0) — invisible —
 * which is the correct degradation for a purely decorative progress hint. It is
 * aria-hidden for the same reason: a scrollbar already communicates this to
 * assistive technology.
 *
 * Long documents only: a PDP or an article. Not a queue and not a dashboard.
 */
export function ScrollProgress({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("u-scroll-progress", className)} />;
}
