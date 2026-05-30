"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Star, Heart, Truck } from "lucide-react";
import { formatCurrency } from "@manzil/utils";
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

  return (
    <Link href={`/products/${slug}`} className="group block bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200">
      {/* Image */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <span className="text-3xl mb-1">📦</span>
            <p className="text-xs">No image</p>
          </div>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-xs font-semibold px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
        {badge === "HOT" && !discount && (
          <div className="absolute top-2 start-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            HOT
          </div>
        )}
        {badge === "NEW" && !discount && (
          <div className="absolute top-2 start-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            NEW
          </div>
        )}
        {discount && (
          <div className="absolute top-2 start-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </div>
        )}
        {isB2B && (
          <div className="absolute top-2 start-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">B2B</div>
        )}
        <button
          type="button"
          onClick={handleWishlist}
          className={`absolute top-2 end-2 p-1.5 rounded-full transition-all shadow-sm ${wishlisted ? "bg-red-500 text-white" : "bg-white/90 text-muted-foreground hover:bg-white hover:text-red-500"}`}
          title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`h-3.5 w-3.5 ${wishlisted ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        {category && <p className="text-xs text-green-600 font-medium mb-0.5">{category}</p>}
        {!category && sellerName && <p className="text-xs text-muted-foreground mb-0.5 truncate">{sellerName}</p>}
        <h3 className="text-sm font-medium line-clamp-2 mb-1.5 min-h-[2.5rem]">{name}</h3>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex">
            {[1,2,3,4,5].map((s) => (
              <Star key={s} className={`h-3 w-3 ${s <= Math.round(rating) ? "text-amber-400 fill-current" : "text-gray-200 fill-current"}`} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{rating.toFixed(1)}{reviewCount ? ` (${reviewCount})` : ""}</span>
        </div>

        {/* Price */}
        <div className="mb-1">
          {originalPrice && originalPrice > price && (
            <span className="text-xs text-gray-400 line-through me-1">{formatCurrency(originalPrice, currency as "AED", locale)}</span>
          )}
          <span className="text-base font-bold text-green-600">{formatCurrency(price, currency as "AED", locale)}</span>
          {moq > 1 && <p className="text-xs text-muted-foreground">Min. {moq}</p>}
        </div>

        {/* Delivery */}
        <div className="flex items-center gap-1 mb-2 text-xs text-green-600">
          <Truck className="h-3 w-3" />
          <span>Free delivery 200+ AED</span>
        </div>

        {/* Add to Cart - full width */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!inStock}
          className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold py-2 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Add to Cart
        </button>
      </div>
    </Link>
  );
}
