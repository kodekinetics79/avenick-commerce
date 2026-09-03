import * as React from "react";
import { Skeleton, Surface } from "@avenick/ui";

/**
 * The storefront product grid, in one place.
 *
 * Five surfaces (home, /products, /search, /deals, /categories/[slug]) each wrote
 * their own column counts and gaps, so a card was 4-up on one page, 5-up on
 * another and 3-up on a third at the same viewport width and the whole storefront
 * lost its rhythm. The counts are looked up from a static map rather than
 * interpolated, because a class string built at runtime is invisible to
 * Tailwind's scanner and would simply not be generated.
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
  return <div className={`grid gap-4 sm:gap-5 ${COLUMNS[columns]}`}>{children}</div>;
}

/**
 * Stands in for a grid of <ProductCard>s while the catalog query resolves.
 *
 * It occupies the same box as the loaded card — square image, eyebrow, two title
 * lines, a metadata line, a figure and a full-width control — so the page does
 * not visibly reassemble itself when the products land. A generic centred
 * spinner told the visitor nothing about what was coming.
 */
export function ProductGridSkeleton({ count = 8, columns = 4 }: { count?: number; columns?: 4 | 5 }) {
  return (
    <>
      {/* The tiles are hidden from assistive technology — a screen-reader user
          has no use for eight boxes of nothing — so the fact that the page is
          waiting has to be said in words somewhere, or the wait is silent. */}
      <p role="status" className="sr-only">
        Loading products.
      </p>
      <ProductGrid columns={columns}>
        {Array.from({ length: count }).map((_, i) => (
          // Surface, not a hand-written data-rung div. The placeholder has to be
          // the same object at the same rung as the card that replaces it, or
          // the grid visibly re-materialises when the products land.
          <Surface key={i} rung={2} className="overflow-hidden" aria-hidden="true">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-28" />
            </div>
            <div className="p-4 pt-0">
              <Skeleton className="h-control-md w-full rounded-nested" />
            </div>
          </Surface>
        ))}
      </ProductGrid>
    </>
  );
}
