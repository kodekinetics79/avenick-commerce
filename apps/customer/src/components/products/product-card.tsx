"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Star, Heart, Truck, Package } from "lucide-react";
import { formatCurrency } from "@avenick/utils";
import { useCartStore } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";

interface ProductCardProps {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  sku: string;
  sellerId: string;
  sellerName?: string;
  inStock?: boolean;
  moq?: number;
  rating?: number;
  reviewCount?: number;
  locale?: "ar" | "en";
  isB2B?: boolean;
  badge?: "HOT" | "NEW" | "SALE" | null;
  category?: string;
}

export function ProductCard({
  id, slug, nameEn, nameAr, imageUrl, price, originalPrice, currency = "AED",
  sku, sellerId, sellerName, inStock = true, moq = 1,
  rating = 4.2, reviewCount, locale = "en", isB2B = false,
  badge = null, category,
}: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const { toggle, has } = useWishlist();
  const wishlisted = has(id);
  const name = locale === "ar" ? nameAr : nameEn;
  const discount = originalPrice && originalPrice > price
    ? Math.round((1 - price / originalPrice) * 100)
    : null;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    addItem({ productId: id, nameEn, nameAr, imageUrl, sku, qty: moq, unitPrice: price, sellerId, currency });
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    toggle({ id, slug, nameEn, nameAr, imageUrl, price, currency, sku, sellerId, sellerName, inStock });
  }

  const badgeClass =
    discount || badge === "SALE" ? "bg-danger text-white"
    : badge === "HOT" ? "bg-primary text-primary-foreground shadow-glow-sm"
    : badge === "NEW" ? "bg-accent text-accent-foreground"
    : "";

  return (
    <Link
      href={`/products/${slug}`}
      className="group relative block rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
    >
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

        {/* Wishlist */}
        <button
          type="button"
          onClick={handleWishlist}
          className={`absolute top-2.5 end-2.5 grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-all ${wishlisted ? "bg-danger text-white" : "bg-background/70 text-muted-foreground hover:text-danger"}`}
          title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} />
        </button>

        {!inStock && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]">
            <span className="rounded-full bg-foreground text-background text-xs font-semibold px-3 py-1">Out of stock</span>
          </div>
        )}

        {/* Quick add on hover */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!inStock}
          className="absolute inset-x-2.5 bottom-2.5 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="h-3.5 w-3.5" /> Add to cart
        </button>
      </div>

      {/* Content */}
      <div className="p-3.5">
        <p className="text-[11px] font-medium text-primary mb-1 truncate">{category ?? sellerName ?? "Avenick"}</p>
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem] text-foreground">{name}</h3>

        <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-current" />
          <span className="text-xs font-medium text-foreground">{rating.toFixed(1)}</span>
          {reviewCount ? <span className="text-xs">({reviewCount})</span> : null}
        </div>

        <div className="mt-2.5 flex items-end justify-between">
          <div>
            {originalPrice && originalPrice > price && (
              <span className="block text-xs text-muted-foreground line-through font-mono">{formatCurrency(originalPrice, currency as "AED", locale)}</span>
            )}
            <span className="text-lg font-bold font-mono tracking-tight text-foreground">{formatCurrency(price, currency as "AED", locale)}</span>
            {moq > 1 && <span className="block text-[11px] text-muted-foreground">Min. {moq} units</span>}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-success">
            <Truck className="h-3.5 w-3.5" /> Fast
          </span>
        </div>
      </div>
    </Link>
  );
}
