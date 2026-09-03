import * as React from "react";
import { BadgeCheck, Award } from "lucide-react";
import { BrassPill } from "./status-pill";

/**
 * TierMark — the ONLY component permitted to emit brass outside the active-nav
 * rule.
 *
 * Brass is the entire GCC gesture in this system: a hairline and a mark, never a
 * gold-plated surface, never a souk motif, never a fill or a gradient or a
 * button. Its budget is 2% of viewport pixels, which a rule and a small mark
 * cannot exceed and a filled chip immediately would.
 *
 * The tier label itself is a caller-supplied enum→label map, not an invented
 * claim: TierMark renders the tier a seller actually has.
 */
export interface TierMarkProps {
  /** The seller tier as stored, e.g. "GOLD" | "PLATINUM" | "VERIFIED" | "STANDARD". */
  tier?: string;
  /** Display label for the tier. Defaults to the raw value. */
  label?: string;
  /** Renders the verification mark alongside. */
  verified?: boolean;
  /** Accessible text for the verification mark. */
  verifiedLabel?: string;
  className?: string;
}

export function TierMark({ tier, label, verified = false, verifiedLabel = "Verified", className }: TierMarkProps) {
  if (!tier && !verified) return null;

  return (
    <span className={className}>
      {tier && (
        <BrassPill>
          <Award className="h-3 w-3" aria-hidden="true" />
          {label ?? tier}
        </BrassPill>
      )}
      {verified && (
        <span className="u-micro ms-1.5 inline-flex items-center gap-1 text-brass-ink">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{verifiedLabel}</span>
        </span>
      )}
    </span>
  );
}
