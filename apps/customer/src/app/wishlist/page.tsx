"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, Trash2, PackageSearch } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@avenick/ui";
import { useWishlist } from "@/stores/wishlist";
import { useCartStore } from "@/stores/cart";
import { formatCurrency } from "@avenick/utils";

export default function WishlistPage() {
  const { items, remove } = useWishlist();
  const addItem = useCartStore((s) => s.addItem);

  function addToCart(item: typeof items[0]) {
    addItem({ productId: item.id, nameEn: item.nameEn, nameAr: item.nameAr, imageUrl: item.imageUrl, sku: item.sku, qty: 1, unitPrice: item.price, sellerId: item.sellerId, currency: item.currency });
  }

  function addAllToCart() {
    items.filter((i) => i.inStock).forEach(addToCart);
  }

  return (
    <MainLayout>
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Heart className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">My Wishlist</h1>
                <p className="text-sm text-muted-foreground">{items.length} saved item{items.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            {items.length > 0 && (
              <Button variant="primary" size="sm" onClick={addAllToCart}>
                <ShoppingCart className="h-3.5 w-3.5 me-1.5" />
                Add All to Cart
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-border text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <Heart className="h-8 w-8 text-red-200" />
              </div>
              <p className="text-lg font-semibold mb-1">Your wishlist is empty</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Tap the heart icon on any product to save it here for later.
              </p>
              <div className="flex gap-3">
                <Button asChild variant="primary"><Link href="/products">Browse Products</Link></Button>
                <Button asChild variant="ghost"><Link href="/deals">View Deals</Link></Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all group">
                  <Link href={`/products/${item.slug}`} className="block relative aspect-square bg-slate-50 overflow-hidden">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.nameEn} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 50vw, 25vw" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                        <PackageSearch className="h-10 w-10 mb-1 opacity-30" />
                      </div>
                    )}
                    {!item.inStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-white text-xs font-semibold px-3 py-1.5 rounded-full">Out of Stock</span>
                      </div>
                    )}
                    {item.inStock && (
                      <span className="absolute top-2 start-2 bg-primary/100 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">In Stock</span>
                    )}
                  </Link>
                  <div className="p-3.5">
                    {item.sellerName && <p className="text-xs text-muted-foreground mb-0.5 truncate">{item.sellerName}</p>}
                    <Link href={`/products/${item.slug}`}>
                      <h3 className="text-sm font-semibold hover:text-primary transition-colors line-clamp-2 mb-2 leading-snug min-h-[2.5rem]">{item.nameEn}</h3>
                    </Link>
                    <p className="text-lg font-bold text-primary mb-3">{formatCurrency(item.price, item.currency as "AED")}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary" className="flex-1" disabled={!item.inStock} onClick={() => addToCart(item)}>
                        <ShoppingCart className="h-3.5 w-3.5 me-1" />
                        Add to Cart
                      </Button>
                      <button type="button" aria-label="Remove from wishlist" onClick={() => remove(item.id)} className="p-1.5 rounded-xl border border-border text-muted-foreground hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
