import * as React from "react";
import { BadgeCheck, Award } from "lucide-react";
import { cn } from "@avenick/utils";
import { BrassPill } from "./status-pill";

/**
 * TierMark — the ONLY component permitted to emit brass outside the active-nav
 * rule, and now the home of THE SEAL.
 *
 * Brass is the entire GCC gesture in this system: a hairline and a mark, never a
 * gold-plated surface, never a souk motif, never a fill or a gradient or a
 * button. Its budget is 2% of viewport pixels, which a rule and a small mark
 * cannot exceed and a filled chip immediately would.
 *
 * THE SEAL. On hover or keyboard focus, a single arc of brass light travels once
 * around the verification mark's 1px border in 2.6 seconds and stops. It is the
 * most beautiful gesture in the product, and it is welded to a fact:
 *
 *   <TierMark verified> THROWS IN DEVELOPMENT WITHOUT A `basis` STRING.
 *
 * That is not a nicety. A brass arc travelling around a badge that says
 * "Verified" with no reviewed SellerDocument behind it is a fabricated trust
 * signal rendered in CSS — precisely the class of thing the hardening programme
 * spent months removing, and precisely what gets added in a hurry because a
 * supplier card looked empty. `basis` is the citation: "Trade licence reviewed
 * 14 Feb 2026", drawn from a SellerDocument row with status APPROVED and a real
 * reviewedAt. Do not make it optional "for now".
 *
 * The arc runs ONE iteration, on hover or focus only. Never infinite: eight
 * supplier cards each spinning a conic border forever is eight continuously
 * invalidated paints, it drains a phone, and it reads as a crypto landing page.
 * Under reduced motion the arc parks at 62deg at .6 opacity — still legible as a
 * mark, because a reduced-motion path that is dead is a worse product than the
 * animation it was protecting against.
 *
 * BUDGET: one animated seal per viewport.
 *
 * The tier label itself is a caller-supplied enum→label map, not an invented
 * claim: TierMark renders the tier a seller actually has.
 */
export interface TierMarkProps {
  /** The seller tier as stored, e.g. "GOLD" | "PLATINUM" | "VERIFIED" | "STANDARD". */
  tier?: string;
  /** Display label for the tier. Defaults to the raw value. */
  label?: string;
  /** Renders the verification seal alongside. REQUIRES `basis`. */
  verified?: boolean;
  /** Accessible text for the verification mark. */
  verifiedLabel?: string;
  /**
   * The document this verification cites, already formatted and localised —
   * e.g. "Trade licence reviewed 14 Feb 2026". REQUIRED whenever `verified` is
   * passed. Rendered in the provenance voice beside the mark.
   */
  basis?: string;
  /** Renders `basis` as a visible provenance line rather than only as a title. */
  showBasis?: boolean;
  className?: string;
}

export function TierMark({
  tier,
  label,
  verified = false,
  verifiedLabel = "Verified",
  basis,
  showBasis = false,
  className,
}: TierMarkProps) {
  // HARD GATE. A seal with no cited document does not render at all.
  if (process.env.NODE_ENV !== "production" && verified && !basis) {
    throw new Error(
      "<TierMark verified> requires `basis` — the document that was reviewed and when, e.g. \"Trade licence reviewed 14 Feb 2026\". A verification mark with no cited SellerDocument is a fabricated trust signal. If the data is not there, do not render the mark.",
    );
  }
  if (verified && !basis) return null;

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
        <>
          {/*
            tabIndex=0 is deliberate and is the accessibility half of the effect:
            the arc runs on :focus-visible as well as :hover, so a keyboard user
            reaches the same gesture a mouse user does. The title carries the
            citation for a pointer user who does not scroll to the line below.
          */}
          <span
            className={cn("u-seal u-focus u-micro ms-1.5 text-brass-ink", tier && "align-middle")}
            tabIndex={0}
            role="note"
            title={basis}
            aria-label={`${verifiedLabel} — ${basis}`}
          >
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span aria-hidden="true">{verifiedLabel}</span>
          </span>
          {showBasis && basis && (
            // The provenance voice — Source Serif italic in English, upright Noto
            // Naskh in Arabic. The most beautiful gesture in the product is
            // load-bearing on a fact, and this is where the fact is printed.
            <span className="u-provenance ms-1.5 align-middle" aria-hidden="true">
              {basis}
            </span>
          )}
        </>
      )}
    </span>
  );
}
