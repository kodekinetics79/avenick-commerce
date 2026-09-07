import * as React from "react";
import { getTranslations } from "next-intl/server";
import { platformName } from "@avenick/utils/portal-config";
import { BrandMark } from "@avenick/ui";

/**
 * The route-level loading state.
 *
 * WHAT WAS HERE. A hardcoded letter "A" — not platformName(), so a deployment
 * that renamed the platform still loaded behind somebody else's initial — in a
 * `bg-gradient-to-br from-primary to-accent` tile, at `font-black`, with a
 * `blur-xl` glow halo behind it, running `animate-pulse` on the halo,
 * `animate-bounce` on the tile and `animate-spin` on a ring, under an English
 * literal "Loading...".
 *
 * That is five separate refusals in twelve lines: the second ambient gradient
 * (§3.7 — the field is the only one), a glow (§3.10 — "there are no glow tokens.
 * --glow-* stays undefined"), a weight the type ladder does not define (LAW C —
 * weights are 400/500/600), three infinite idle animations against a
 * product-wide budget of two (§5), and a literal English string in JSX (§9 —
 * "the defect that shipped last round").
 *
 * WHAT IS HERE NOW. The mark the rest of the product draws, holding still, over
 * the one shimmer §5 does permit. The shimmer is the skeleton's, which is to say
 * the one already running everywhere else — a loading screen is not the place to
 * introduce the product's third infinite animation.
 *
 * LAW D: motion is a readout, never a gate. Nothing here moves to entertain; the
 * bar reports that a request is outstanding and stops when it is not.
 */
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={t("loading")}
    >
      <div className="flex flex-col items-center gap-5">
        <BrandMark name={platformName()} size={56} />
        {/* The shimmer, not a spinner: the same material the skeletons use, so a
            route that resolves into skeletons does not change vocabulary as it
            lands. 96px of it, at the mark's own width. */}
        <div className="skeleton h-1 w-24 rounded-pill" />
      </div>
    </div>
  );
}
