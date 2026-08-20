"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Star, Heart, MessageSquare, Package } from "lucide-react";
import { formatCurrency } from "@avenick/utils";
import { useCartStore } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { productCardPricePresentation, productCardPurchaseAction, productCardReviewState, storefrontProductHref } from "@/lib/product-card-commerce";

interface ProductCardProps {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  vatRate?: number;
  priceIsFrom?: boolean;
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
  badge?: "HOT" | "NEW" | "SALE" | null;
  category?: string;
}

export function ProductCard({
  id, slug, nameEn, nameAr, imageUrl, price, originalPrice, currency, vatRate, priceIsFrom = false,
  sku, sellerId, sellerName, inStock = true, availabilityStatus, moq = 1, hasVariants = false,
  rating, reviewCount = 0, locale, isB2B = false,
  badge = null, category,
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
  const discount = price != null && originalPrice && originalPrice > price
    ? Math.round((1 - price / originalPrice) * 100)
    : null;
  const review = productCardReviewState(rating, reviewCount);
  const pricePresentation = productCardPricePresentation(price, hasVariants);
  const productHref = storefrontProductHref(slug, { currency, b2b: isB2B });
  const availability = availabilityStatus ?? (inStock ? "IN_STOCK" : "OUT_OF_STOCK");

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
    addItem({ productId: id, slug, channel: isB2B ? "B2B" : "B2C", nameEn, nameAr, imageUrl, sku, qty: moq, moq, unitPrice: price, vatRate, sellerId, currency });
  }

  function handleWishlist() {
    if (hasVariants) {
      router.push(productHref);
      return;
    }
    if (price == null || !currency || vatRate == null) return;
    toggle({ id, slug, channel: isB2B ? "B2B" : "B2C", nameEn, nameAr, imageUrl, price, quantity: moq, moq, vatRate, currency, sku, sellerId, sellerName, inStock });
  }

  const badgeClass =
    discount || badge === "SALE" ? "bg-danger text-white"
    : badge === "HOT" ? "bg-primary text-primary-foreground shadow-glow-sm"
    : badge === "NEW" ? "bg-accent text-accent-foreground"
    : "";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated focus-within:border-primary/60 focus-within:shadow-elevated">
      <Link href={productHref} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-label={`View ${name}`}>
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-secondary to-muted">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground/40">
              <Package className="h-10 w-10" strokeWidth={1.2} />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2.5 start-2.5 flex flex-col gap-1.5">
            {badgeClass && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                {discount ? `-${discount}%` : badge}
              </span>
            )}
            {isB2B && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-foreground text-background">B2B</span>
            )}
          </div>

          {!inStock && (
            <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]">
              <span className="rounded-full bg-foreground text-background text-xs font-semibold px-3 py-1">
                {availability === "UNCONFIRMED" ? "Availability unconfirmed" : tp("outOfStock")}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3.5">
          <p className="text-[11px] font-medium text-primary mb-1 truncate">{category ?? sellerName ?? "Avenick"}</p>
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem] text-foreground">{name}</h3>

          {review.kind === "RATED" ? (
            <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-current" />
              <span className="text-xs font-medium text-foreground">{review.rating.toFixed(1)}</span>
              <span className="text-xs">({review.reviewCount})</span>
            </div>
          ) : <p className="mt-1.5 text-xs text-muted-foreground">No reviews yet</p>}

          <div className="mt-2.5 flex items-end justify-between">
            <div>
              {price != null && originalPrice && originalPrice > price && currency && (
                <span className="block text-xs text-muted-foreground line-through font-mono">{formatCurrency(originalPrice, currency as "AED", activeLocale)}</span>
              )}
              <span className="text-lg font-bold font-mono tracking-tight text-foreground">{price != null && currency ? `${pricePresentation === "FROM" || priceIsFrom ? "From " : ""}${formatCurrency(price, currency as "AED", activeLocale)}` : "See options"}</span>
              {moq > 1 && <span className="block text-[11px] text-muted-foreground">{tp("minOrder")}: {moq} {tp("units")}</span>}
            </div>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={handleWishlist}
        disabled={!hasVariants && (price == null || !currency || vatRate == null)}
        className={`absolute top-2.5 end-2.5 z-10 grid h-10 w-10 place-items-center rounded-full border border-border/70 backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${wishlisted ? "bg-danger text-white" : "bg-background/90 text-muted-foreground hover:text-danger"}`}
        aria-label={wishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
        aria-pressed={wishlisted}
      >
        <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} />
      </button>

      <div className="mt-auto p-3.5 pt-0">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={inStock && !hasVariants && (price == null || !currency || vatRate == null)}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inStock ? <ShoppingCart className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
          {inStock ? (hasVariants ? "Select options" : tp("addToCart")) : "Request availability"}
        </button>
      </div>
    </article>
  );
}
