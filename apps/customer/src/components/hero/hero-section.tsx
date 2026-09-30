import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button, DisplayPlate, HeroCopy, HeroSpecimen, HeroStage, Reveal, Surface } from "@avenick/ui";
import { HeroCarousel } from "./hero-carousel";
import type { HeroSlide } from "./hero-slides";

/**
 * The storefront hero, as the system's own composition rather than a slab with
 * text in it.
 *
 * WHAT CHANGED AND WHY. The hero was one flat panel: copy on the left, the
 * carousel on the right, both in normal flow on a two-stop green fill. Every
 * piece the design system ships for exactly this surface — <HeroStage> and its
 * three depth planes, <HeroCopy>'s seven columns, <HeroSpecimen>'s four,
 * <DisplayPlate> and display glass — had ZERO call sites in this app. The page
 * looked flat because the depth was written and never used, not because the
 * system had nothing to say.
 *
 * DEPTH IS Z-POSITION, NEVER ROTATION (§9). The stage is a bounded perspective
 * box: the back plane sits at translateZ −260 and drifts on a view() timeline
 * where one exists, the mid plane at −110, and the FRONT plane — every word,
 * price and control — stays in normal flow, so the stage's height is
 * content-driven and `contain: paint` can never clip a headline.
 *
 * NOTHING FIXED MAY LIVE IN HERE. `perspective` makes this element the
 * containing block for any `position: fixed` descendant, which is how a dialog
 * once ended up at the end of the document with a scrim that still looked
 * right. The carousel holds no fixed element, and no drawer, sheet or dialog
 * may be mounted inside this subtree.
 *
 * THE FROSTED PANEL IS THE ONE DISPLAY-GLASS OBJECT ON THIS ROUTE. It carries
 * no text at all, which is the material's rule: at .58 alpha a 13px label's
 * contrast would depend on where the ambient field happened to have drifted.
 * <Surface> throws in development on a second one, on glass below rung 4, and
 * on display glass outside the customer portal. With the header's chrome glass
 * and the carousel caption's, this route sits exactly at the ≤3 blurred
 * surfaces budget, of which ≤1 is display.
 *
 * THE GROUND STAYS .u-panel-brand. A near-black band was tried here and
 * reverted: on a paper page it read as slate rather than ink at every alpha,
 * and §3.1's warning about a dark section inside a light one turned out to
 * be right. The range this hero gained is in TYPE and COMPOSITION instead —
 * the display rung, the stage's planes and the frosted plinth. .u-sheen and
 * the tiled grain ride on the stage element itself.
 */
export async function HeroSection({
  slides,
  priceLine,
}: {
  slides: HeroSlide[];
  /** The specimen's figure, only when the catalogue published one for a single specimen. */
  priceLine: string | null;
}) {
  const t = await getTranslations("home");

  return (
    <HeroStage
      planes={3}
      data-grain=""
      className="u-sheen u-panel-brand relative min-w-0 overflow-clip rounded-[1.75rem] p-6 sm:p-12 lg:p-16"
      /* Decorative only, and aria-hidden by <HeroStage>. The plate is the
         system's generated object: a mirrored conic field that is correct in
         both reading directions. Its own grain is off — the slab above it
         already carries one, and the budget is ≤3 grained elements per
         viewport, never stacked for no gain. */
      backPlane={
        <DisplayPlate
          grain={false}
          rim={false}
          /* It BLEEDS past the slab, which clips it, so the plate contributes a
             lit ground and never an edge: an inset rectangle inside a rounded
             panel reads as a box in a box, which is what it looked like. Hidden
             below lg, where the specimen it sits behind is hidden too and the
             copy is the whole hero. */
          className="absolute inset-[-8%] hidden rounded-none opacity-[0.32] lg:block"
        />
      }
    >
      {/* A size container, so the headline is set against the width it actually
          has rather than the viewport's. */}
      <HeroCopy className="min-w-0 [container-type:inline-size]">
        <Reveal index={0}>
          <p className="u-meta font-semibold uppercase tracking-[0.2em] rtl:tracking-normal text-white/85">{t("heroTagline")}</p>
        </Reveal>

        {/* Light over SemiBold, and the size follows the COLUMN, not the
            viewport: the copy well is seven of twelve columns inside a slab
            that the category rail already narrows, so a viewport-stepped size
            set in three or four lines at every desktop width. The longer line
            is ≈9.1em, so 10.5cqi fills about 95% of the well at any width.
            Narrow screens use a 2.25rem floor to keep buying actions in view.
            Shared hero tokens own script-aware leading, tracking and typeface;
            Arabic must not inherit tightly stacked Latin glyph metrics.

            The {" "} between the spans is the word space. Without it the
            heading's text reads "clarity.Buy" to anything that reads
            textContent — a crawler, a snippet, a copy-paste. */}
        <Reveal index={1} as="h1" className="u-hero text-white">
          <span className="block text-[2.25rem] font-light rtl:font-normal supports-[width:1cqi]:text-[length:clamp(2.25rem,12cqi,5.25rem)]">
            {t("heroTitle1")}
          </span>{" "}
          <span className="block text-[2.25rem] font-semibold supports-[width:1cqi]:text-[length:clamp(2.25rem,12cqi,5.25rem)]">
            {t("heroTitle2")}
          </span>
        </Reveal>

        <Reveal index={2}>
          <p className="u-lead max-w-desc text-white/75">{t("heroDesc")}</p>
        </Reveal>

        {/* A figure this size in this position is read as an offer, so it
            renders only when the catalogue actually published one, and only
            while the object beside it is a single product. With the carousel
            turning, each slide's own caption carries its figure instead. */}
        {priceLine && (
          <Reveal index={3}>
            <p className="tnum text-[2.5rem] font-bold leading-none text-white">{priceLine}</p>
          </Reveal>
        )}

        <Reveal index={4}>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="lg" className="u-shine" asChild>
              <Link href="/products">
                {t("allProducts")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="ghost" size="lg" className="text-white hover:bg-white/10 hover:text-white" asChild>
              <Link href="/b2b/rfq/new">{t("requestQuote")}</Link>
            </Button>
          </div>
        </Reveal>
      </HeroCopy>

      {/* The object: real listings the buyer can click, held to lg and up. On a
          phone the copy and the call to action are the hero, and a 20rem object
          above them would push the action under the fold. */}
      {slides.length > 0 ? (
        <HeroSpecimen className="relative hidden lg:block">
          {/* THE FROSTED PLINTH, and the one display-glass object on this route.
              It sits BEHIND the specimen rather than over it: a frosted panel
              floating across the object read as an empty card, while the same
              panel under it gives the product something to stand on and lets
              the slab's own colour through it. It carries no text at all, which
              is the material's rule — at .58 alpha a 13px label's contrast would
              depend on where the ambient field had drifted. */}
          <Surface
            rung={4}
            glass="display"
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-6 -inset-y-4 -z-10 rounded-[2rem]"
          />
          <Reveal index={2}>
            <HeroCarousel slides={slides} />
          </Reveal>
        </HeroSpecimen>
      ) : null}
    </HeroStage>
  );
}
