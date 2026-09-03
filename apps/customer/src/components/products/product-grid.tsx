import * as React from "react";
import { LightGrid, Skeleton, SkeletonImageFrame } from "@avenick/ui";

/**
 * The storefront product grid, in one place.
 *
 * Five surfaces (home, /products, /search, /deals, /categories/[slug]) each wrote
 * their own column counts and gaps, so a card was 4-up on one page, 5-up on
 * another and 3-up on a third at the same viewport width and the whole storefront
 * lost its rhythm. The counts are looked up from a static map rather than
 * interpolated, because a class string built at runtime is invisible to
 * Tailwind's scanner and would simply not be generated.
 *
 * IT IS A <LightGrid>, WHICH IS THE POINT. One pointermove listener on the
 * container writes --mx/--my onto every tracked card from that card's own rect,
 * so a soft light travels across the whole grid and the cards read as one lit
 * material rather than as twenty-four independent hover states. The alternative
 * — a listener per card, which is the obvious implementation — is twenty-four
 * handlers doing twenty-four rAF writes, and it is exactly the mid-range-Android
 * jank the performance law names. The island early-RETURNS before attaching on a
 * coarse pointer, under reduced motion and under Save-Data, so on a phone
 * nothing is registered at all.
 *
 * NO STAGGERED REVEAL HERE, DELIBERATELY. Every grid this component renders is a
 * result set the visitor asked a question to get — a category, a search, a
 * filter. Staggering those is the canonical "this site is slow" generator: the
 * answer arrives in pieces after the answer already exists. Stagger belongs to
 * content nobody requested (a category strip on first paint, a hero's supporting
 * elements), which is where /search uses it.
 */
const COLUMNS: Record<4 | 5, string> = {
  4: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
};

export function ProductGrid({
  columns = 4,
  children,
}: {
  columns?: 4 | 5;
  children: React.ReactNode;
}) {
  return (
    <LightGrid className={`grid gap-stack sm:gap-5 ${COLUMNS[columns]}`}>{children}</LightGrid>
  );
}

/**
 * Stands in for a grid of <ProductCard>s while the catalog query resolves.
 *
 * It occupies the same box as the loaded card — the SAME <ImageFrame> at the
 * same 4:5 ratio, on the same lit plate, then the record line, two title lines,
 * a figure at card rank and a full-width control — so the page does not visibly
 * reassemble itself when the products land. The plate is already lit before the
 * photograph arrives, which is the whole point of a skeleton: a page that
 * assembles itself in front of you cannot look expensive no matter what it
 * assembles into.
 *
 * It deliberately has NO rating row, because the card has no rating row. A
 * skeleton that promises an element the loaded state does not have is a layout
 * shift with extra steps.
 *
 * `label` is required rather than defaulted, because the one thing this
 * component says out loud has to come from the message tree: a Suspense fallback
 * renders synchronously and so cannot await a translator itself.
 */
export function ProductGridSkeleton({
  count = 8,
  columns = 4,
  label,
}: {
  count?: number;
  columns?: 4 | 5;
  label: string;
}) {
  return (
    <>
      {/* The tiles are hidden from assistive technology — a screen-reader user
          has no use for eight boxes of nothing — so the fact that the page is
          waiting has to be said in words somewhere, or the wait is silent. */}
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className={`grid gap-stack sm:gap-5 ${COLUMNS[columns]}`}>
        {Array.from({ length: count }).map((_, i) => (
          // A plain rung-2 box rather than <Surface interactive>: the placeholder
          // must be the same OBJECT at the same rung as the card that replaces
          // it, but it must not offer a hover state for something that is not
          // there yet.
          <div
            key={i}
            data-rung={2}
            className="flex h-full flex-col overflow-hidden border border-border"
            aria-hidden="true"
          >
            <SkeletonImageFrame />
            {/* The 2px slot the brass rule occupies on the loaded card. Without
                it every tile jumps 2px the moment the products land. */}
            <div className="h-0.5" />
            <div className="flex flex-col gap-1.5 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-2.5 w-12" />
              </div>
              {/* The title block reserves the SAME two lines of the ACTIVE
                  script's own leading that the card's <h3> does — not two 16px
                  bars, which under-reserve by ten pixels in Latin and more in
                  Arabic and hand the page a layout shift on every tile. */}
              <div className="flex min-h-[calc(2*var(--lh-body))] flex-col justify-center gap-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="mt-0.5 h-[var(--lh-fig-card)] w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            {/* p-4 pt-3, exactly as the card's action block is. It was pt-0,
                which is a twelve-pixel shift under every control on the page. */}
            <div className="mt-auto p-4 pt-3">
              <Skeleton className="h-control-md w-full rounded-nested" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
