import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * AmbientField — the ruled ground, and the one gradient permitted anywhere in
 * the product.
 *
 * Mount it EXACTLY ONCE, in a root layout. Two stacked fields double the ambient
 * alpha on that page only, which produces exactly the visible-orb failure the
 * single field was built to avoid and silently breaks every contrast ceiling the
 * alphas were derived from. There is no page-local variant and there will not be
 * one; a hero gets its richness from <DisplayPlate> and the ruled ground, never
 * from a second field.
 *
 * What round one had was invisible: .055/.040 alpha measures below perceptual
 * threshold on a white ground, so the product's one atmospheric gesture was
 * doing nothing at all. It is now FELT, and it MOVES — two counter-drifting
 * blurred lobes on 34s and 47s cycles. Those numbers are coprime, so the layers
 * never visibly re-sync, which is what stops it reading as a loop.
 *
 * Under it all: a masked repeating hairline at exactly --lh-body, so the whole
 * page sits on faint ledger ruling that dissolves before it reaches any word.
 * That is the identity. It costs one repeating-linear-gradient, the rules are
 * horizontal so it is byte-identical in Arabic, and it says the one true thing
 * about this product — this is a register, not a shop.
 *
 * Intensity is a portal token: 1.0 customer, 0.30 seller, 0.15 admin. The single
 * fastest way to break this direction is to turn it up so it is visible on admin
 * too; the effect dies behind tables and forms, and two of three portals ARE
 * tables and forms.
 *
 * Zero JavaScript. The drift is a transform on a pre-painted layer, never
 * background-position and never gradient stops, both of which repaint every
 * frame. Off entirely under prefers-reduced-motion, prefers-reduced-data and
 * Save-Data.
 */
export function AmbientField({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("u-field", className)}>
      {/* Two children rather than one, because two layers with coprime periods
          is the whole mechanism: one layer cannot counter-drift against itself. */}
      <div className="u-field__lobe u-field__lobe--a" />
      <div className="u-field__lobe u-field__lobe--b" />
    </div>
  );
}
