"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Star, Heart, MessageSquare, Package } from "lucide-react";
import { formatCurrency } from "@avenick/utils";
import { Button, Eyebrow, Num, SpecularSurface, StatusPill, Surface } from "@avenick/ui";
import { useCartStore } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { productCardPricePresentation, productCardPurchaseAction, productCardReviewState, storefrontProductHref } from "@/lib/product-card-commerce";
import type { Currency } from "@/lib/market-context";

interface ProductCardProps {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  vatRate?: number;
  priceIsFrom?: boolean;
  /**
   * From the list DTO: the card price is one of several quantity bands in
   * this currency. Lines added from the grid or saved to the wishlist carry it
   * so the cart sends a quantity change back through the product page instead
   * of editing the line at a tier that may no longer apply.
   *
   * Required, not optional, on purpose: a consumer that forgets to forward
   * `priceTiered` from the DTO would put a tiered product in the cart as a
   * flat-priced line and the stepper would then quietly edit it at the wrong
   * tier. The typechecker refusing the omission is the only place that
   * mistake is visible, so every grid passes `priceTiered={p.priceTiered === true}`.
   */
  priceTiered: boolean;
  sku: string;
  sellerId: string;
  sellerName?: string;
  inStock?: boolean;
  availabilityStatus?: "IN_STOCK" | "OUT_OF_STOCK" | "UNCONFIRMED";
  hasVariants?: boolean;
  moq?: number;
  rating?: number;
  reviewCount?: number;
  locale?: "ar" | "en";
  isB2B?: boolean;
  category?: string;
}

/*
 * The `badge` ("HOT" | "NEW" | "SALE") and `originalPrice` props were removed
 * rather than left unused. No caller ever passed either, and both existed only
 * to render claims the catalog cannot support: "HOT" asserts a demand ranking
 * nothing computes, "NEW" was stamped on every product regardless of age, and a
 * struck-through `originalPrice` is discount theatre for a field the list DTO
 * does not return. Leaving the props in place left a working, typed doorway back
 * to all three. Do not re-add them.
 */

export function ProductCard({
  id, slug, nameEn, nameAr, imageUrl, price, currency, vatRate, priceIsFrom = false, priceTiered,
  sku, sellerId, sellerName, inStock = true, availabilityStatus, moq = 1, hasVariants = false,
  rating, reviewCount = 0, locale, isB2B = false, category,
}: ProductCardProps) {
  const tp = useTranslations("products");
  const router = useRouter();
  const nextLocale = useLocale();
  const activeLocale = locale || (nextLocale as "en" | "ar");
  const addItem = useCartStore((s) => s.addItem);
  const { toggle, has } = useWishlist();
  // Persisted wishlist state would mismatch on hydration — gate on mount.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const wishlisted = mounted && has(id);
  const name = activeLocale === "ar" ? nameAr : nameEn;
  const review = productCardReviewState(rating, reviewCount);
  const pricePresentation = productCardPricePresentation(price, hasVariants);
  const productHref = storefrontProductHref(slug, { currency, b2b: isB2B });
  const availability = availabilityStatus ?? (inStock ? "IN_STOCK" : "OUT_OF_STOCK");
  const money = price != null && currency
    ? formatCurrency(price, currency as Currency, activeLocale)
    : null;
  // Whether the card price is the lowest of several quantity or variant bands
  // rather than THE price. It qualifies the figure; it is not part of it.
  const priceIsRange = pricePresentation === "FROM" || priceIsFrom;

  function handleAddToCart() {
    const action = productCardPurchaseAction(hasVariants, inStock);
    if (action === "REQUEST_AVAILABILITY") {
      router.push(`/b2b/rfq/new?supplier=${encodeURIComponent(sellerId)}&product=${encodeURIComponent(id)}`);
      return;
    }
    if (action === "SELECT_VARIANT") {
      router.push(productHref);
      return;
    }
    if (price == null || !currency || vatRate == null) return;
    addItem({ productId: id, slug, channel: isB2B ? "B2B" : "B2C", nameEn, nameAr, imageUrl, sku, qty: moq, moq, unitPrice: price, vatRate, priceTiered, sellerId, currency });
  }

  function handleWishlist() {
    if (hasVariants) {
      router.push(productHref);
      return;
    }
    if (price == null || !currency || vatRate == null) return;
    toggle({ id, slug, channel: isB2B ? "B2B" : "B2C", nameEn, nameAr, imageUrl, price, quantity: moq, moq, vatRate, currency, sku, sellerId, sellerName, inStock });
  }

  return (
    // SpecularSurface only feeds --mx/--my to the Surface below it. It carries no
    // styling of its own and early-returns before attaching a listener on a coarse
    // pointer or under reduced motion, so a phone grid registers nothing at all.
    <SpecularSurface className="h-full">
      <Surface
        as="article"
        rung={2}
        interactive
        specular
        className="group relative flex h-full flex-col overflow-hidden"
      >
        {/* The wishlist control stays OUTSIDE this anchor. It is a second action on
            the same card, and an interactive element nested inside a link is
            unreachable by keyboard and ambiguous to a screen reader. */}
        <Link
          href={productHref}
          // The ring is INSET. The card clips its own overflow (the specular
          // gradient requires it), so an outward two-stop ring would be sliced off
          // at three edges and the keyboard user would see nothing.
          className="block rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={`View ${name}`}
        >
          <div className="relative aspect-square overflow-hidden bg-surface-1">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={name}
                fill
                // 1.03 over 320ms, not scale-110: a 10% scale is an expensive
                // repaint across a 24-card grid and it crops the product out of
                // its own photograph.
                className="object-cover transition-transform duration-layer ease-out group-hover:scale-[1.03]"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-ink-3">
                <Package className="h-10 w-10" strokeWidth={1.2} aria-hidden="true" />
              </div>
            )}

            {!inStock && (
              // The scrim is opaque enough to mute the photograph, but the words
              // sit on StatusPill's own opaque plate rather than on the image:
              // text over a translucent layer fails contrast at some images and
              // you cannot test every one.
              <div className="absolute inset-0 grid place-items-center bg-surface-0/75 p-3">
                <StatusPill tone="neutral" className="text-center">
                  {availability === "UNCONFIRMED" ? tp("availabilityUnconfirmed") : tp("outOfStock")}
                </StatusPill>
              </div>
            )}

            {/* After the out-of-stock scrim in source order, so the channel mark
                stays legible on a card the scrim has dimmed. */}
            {isB2B && (
              <StatusPill tone="accent" className="absolute start-2.5 top-2.5">
                B2B
              </StatusPill>
            )}
          </div>

          <div className="p-4">
            {/* The eyebrow names the category or the seller. When neither is known
                it is left empty (height kept) — printing the platform name there
                read as "sold by the platform", which is never true of a listing.

                It is metadata ink rather than --primary-ink: on a grid of 24 this
                is the lowest-rank line on the card, and 24 indigo eyebrows compete
                with the one thing that should carry colour, the price. */}
            <Eyebrow className="min-h-[1rem] truncate">{category ?? sellerName ?? ""}</Eyebrow>

            <h3 className="u-body mt-1 line-clamp-2 min-h-[3rem] font-medium text-ink-1">{name}</h3>

            {review.kind === "RATED" ? (
              <p className="u-meta mt-1.5 flex items-center gap-1.5 text-ink-3">
                <Star className="h-3.5 w-3.5 shrink-0 fill-current text-warning" aria-hidden="true" />
                <span className="fig font-medium text-ink-1">{review.rating.toFixed(1)}</span>
                <span>({review.reviewCount})</span>
              </p>
            ) : (
              // Said plainly rather than hidden: the catalog records no reviews for
              // this product, and an empty slot would read as a rating that failed
              // to load.
              <p className="u-meta mt-1.5 text-ink-3">No reviews yet</p>
            )}

            <div className="mt-3">
              {money ? (
                <p className="flex flex-wrap items-baseline gap-x-1.5">
                  {/* "From" is a qualifier ON the figure, not part of it. Baked
                      into the <Num> string it rendered at the figure's own 20px
                      rank, so a tiered product's price line was one flat 20px
                      run of text — law C's 3× ratio collapsing at exactly the
                      place a shopper looks first. */}
                  {priceIsRange && <span className="u-meta text-ink-3">From</span>}
                  <Num value={money} rank="inline" />
                </p>
              ) : (
                // Deliberately NOT a <Num>. "See options" is an instruction, and
                // setting an instruction at figure rank in tabular numerals told
                // the reader it was a price they had failed to parse.
                <p className="u-ui font-medium text-ink-2">See options</p>
              )}
              {moq > 1 && (
                <p className="u-meta mt-0.5 text-ink-3">
                  {tp("minOrder")}: {moq} {tp("units")}
                </p>
              )}
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={handleWishlist}
          disabled={!hasVariants && (price == null || !currency || vatRate == null)}
          // Opaque, not backdrop-blurred. Blur is a floating-layer mark with a
          // budget of three surfaces per viewport; twenty-four blurred discs in a
          // grid is the number one way this system ships badly.
          className={`u-focus absolute end-2.5 top-2.5 z-10 grid h-10 w-10 place-items-center rounded-pill border border-border shadow-elev-2 transition-colors duration-hover ease-standard disabled:pointer-events-none disabled:opacity-50 ${
            wishlisted ? "bg-danger text-danger-foreground" : "bg-surface-2 text-ink-3 hover:text-danger-ink"
          }`}
          aria-label={wishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
          aria-pressed={wishlisted}
        >
          <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} aria-hidden="true" />
        </button>

        <div className="mt-auto p-4 pt-0">
          {/* Secondary, not primary. The customer portal's budget is one indigo
              fill per view plus the page's single call to action, and a grid of
              twenty-four indigo buttons spends it twenty-four times over — after
              which nothing on the page reads as the commit action. The card's
              action is raised (law A: raised = actionable), which is what makes it
              legible as a button without the fill. */}
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-full"
            onClick={handleAddToCart}
            disabled={inStock && !hasVariants && (price == null || !currency || vatRate == null)}
          >
            {inStock ? <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" /> : <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />}
            {inStock ? (hasVariants ? tp("selectOptions") : tp("addToCart")) : tp("requestAvailability")}
          </Button>
        </div>
      </Surface>
    </SpecularSurface>
  );
}
