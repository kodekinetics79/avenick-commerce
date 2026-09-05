import { Suspense } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { SkipLink } from "./skip-link";
import { RouteFade } from "./route-fade";
import { DiscoveryPanel, type TrendingProduct } from "@/components/discovery";
import { CartDrawerConnected } from "@/components/cart/cart-drawer-connected";

export interface MainLayoutProps {
  children: React.ReactNode;
  /**
   * Rows from getTrendingProducts() in packages/database/src/services/product-signals.ts.
   *
   * THIS IS A PROP RATHER THAN A FETCH, and the reason is structural: MainLayout
   * is rendered from client pages too — /products/[slug], /cart, /checkout and
   * /wishlist all carry "use client" — so it cannot be an async server
   * component and cannot read the catalogue itself. A server page that has the
   * rows passes them down; every other route renders the panel with no trending
   * block, which the panel treats as the normal case rather than an error.
   */
  discoveryTrending?: TrendingProduct[];
}

export function MainLayout({ children, discoveryTrending }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/*
        The reading hairline: a 2px brass rule that draws itself across the top
        of the viewport from the inline start as the document scrolls. Zero
        JavaScript and zero scroll listeners — it is a scaleX on a scroll-driven
        CSS timeline running on the compositor, its transform-origin is the
        --origin-inline-start token so it draws from the right in Arabic for
        free, and it is THE SAME BRASS RULE as active nav, the section marks, the
        certificate's top edge and the hero's mid plane. One gesture in different
        postures is what makes a system read as designed rather than assembled.

        Where scroll timelines are unsupported it stays at scaleX(0) — invisible —
        which is the correct degradation for a purely decorative progress hint,
        and it is aria-hidden because the scrollbar already tells assistive
        technology this.
      */}

      <SkipLink />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <RouteFade>{children}</RouteFade>
      </main>
      <Footer />

      {/*
        The cart drawer — what an add-to-cart opens instead of navigating away.
        Mounted once here so every route that adds to the cart has it, and
        mounted CLOSED: its open flag is not persisted and only a real add sets
        it. It renders no DOM at all until then. Rows for its "You might also
        need" slot reach it as props or through its store; see
        components/cart/completions.ts for the contract.
      */}
      {/* Wired to /api/cart/completions on the client side of the boundary —
          a loader is a function, and a function cannot be passed from this
          server component into a client one. */}
      <CartDrawerConnected />

      {/*
        The discovery panel — a recommender driven by this browser's own trail,
        not an assistant and not a model. It renders NOTHING at all when it has
        nothing to say, and nothing before localStorage has been read, so it
        cannot shift the page or mismatch on hydration.

        The Suspense boundary is required, not decorative: the panel reads
        useSearchParams() to see which category or search a visitor is on, and an
        unbounded useSearchParams() forces every statically prerendered route in
        this app to bail out. Same treatment <NavigationProgress> gets in
        app/layout.tsx, for the same reason.
      */}
      <Suspense fallback={null}>
        <DiscoveryPanel trending={discoveryTrending} />
      </Suspense>
    </div>
  );
}
