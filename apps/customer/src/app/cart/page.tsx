"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Tag, Truck, ShieldCheck, Heart } from "lucide-react";
import { Button } from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import { useCartStore } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { MainLayout } from "@/components/layout/main-layout";
import { VAT_RATES } from "@avenick/utils";

export default function CartPage() {
  const { items, updateQty, removeItem, total } = useCartStore();
  const { toggle } = useWishlist();
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");

  const subtotal = total();
  const vatRate = VAT_RATES["AE"] ?? 5;
  const vatAmount = subtotal * vatRate / 100;
  const discount = promoApplied ? subtotal * 0.1 : 0;
  const shipping = subtotal >= 200 ? 0 : 20;
  const orderTotal = subtotal - discount + vatAmount + shipping;

  function applyPromo() {
    if (promoCode.trim().toUpperCase() === "AVENICK10") {
      setPromoApplied(true);
      setPromoError("");
    } else {
      setPromoError("Invalid promo code");
    }
  }

  function saveForLater(item: typeof items[0]) {
    toggle({ id: item.productId, slug: item.productId, nameEn: item.nameEn, nameAr: item.nameAr, imageUrl: item.imageUrl, price: item.unitPrice, currency: item.currency, sku: item.sku, sellerId: item.sellerId, inStock: true });
    removeItem(item.id);
  }

  if (items.length === 0) {
    return (
      <MainLayout>
        <div className="bg-secondary min-h-screen">
          <div className="max-w-7xl mx-auto px-4 py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white border border-border flex items-center justify-center mx-auto mb-5 shadow-sm">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
            <p className="text-muted-foreground mb-2">سلة التسوق فارغة</p>
            <p className="text-sm text-muted-foreground mb-8">Add items from the marketplace to get started.</p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="primary" size="lg"><Link href="/products">Browse Products</Link></Button>
              <Button asChild variant="ghost" size="lg"><Link href="/deals">View Deals</Link></Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="bg-secondary min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">
            Shopping Cart <span className="text-muted-foreground font-normal text-lg">({items.length} item{items.length !== 1 ? "s" : ""})</span>
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Items list */}
            <div className="lg:col-span-2 space-y-3">
              {/* Free shipping progress */}
              {subtotal < 200 && (
                <div className="bg-white rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <Truck className="h-4 w-4 text-green-600" />
                    <span>Add <strong>{formatCurrency(200 - subtotal, "AED")}</strong> more for free shipping</span>
                  </div>
                  <div className="flex gap-0.5 h-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={`flex-1 rounded-full transition-colors ${i < Math.min(10, Math.floor(subtotal / 20)) ? "bg-green-500" : "bg-slate-100"}`} />
                    ))}
                  </div>
                </div>
              )}
              {subtotal >= 200 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2 text-sm text-green-700">
                  <Truck className="h-4 w-4" />
                  <span className="font-medium">You qualify for free shipping!</span>
                </div>
              )}

              {items.map((item) => (
                <div key={item.id} className="flex gap-4 bg-white rounded-2xl border border-border p-4 hover:shadow-sm transition-shadow">
                  <Link href={`/products/${item.productId}`} className="w-20 h-20 shrink-0 bg-secondary rounded-xl overflow-hidden relative border border-border">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.nameEn} fill className="object-cover" sizes="80px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-sm line-clamp-1">{item.nameEn}</h3>
                        <p className="text-xs text-muted-foreground">{item.nameAr}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">SKU: {item.sku}</p>
                      </div>
                      <span className="font-bold text-primary shrink-0">{formatCurrency(item.unitPrice * item.qty, "AED")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(item.unitPrice, "AED")} each</p>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-border rounded-lg overflow-hidden">
                        <button type="button" aria-label="Decrease quantity" onClick={() => updateQty(item.id, item.qty - 1)} className="p-1.5 hover:bg-secondary transition-colors"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="px-3 text-sm font-semibold min-w-[2rem] text-center">{item.qty}</span>
                        <button type="button" aria-label="Increase quantity" onClick={() => updateQty(item.id, item.qty + 1)} className="p-1.5 hover:bg-secondary transition-colors"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => saveForLater(item)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10">
                          <Heart className="h-3.5 w-3.5" /> Save
                        </button>
                        <button type="button" aria-label="Remove item" onClick={() => removeItem(item.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order summary */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-border p-5 sticky top-24">
                <h2 className="text-base font-bold mb-4">Order Summary</h2>

                <div className="space-y-2.5 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({items.length} items)</span>
                    <span>{formatCurrency(subtotal, "AED")}</span>
                  </div>
                  {promoApplied && (
                    <div className="flex justify-between text-green-600">
                      <span>Promo (AVENICK10)</span>
                      <span>-{formatCurrency(discount, "AED")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT ({vatRate}%)</span>
                    <span>{formatCurrency(vatAmount, "AED")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    {shipping === 0
                      ? <span className="text-green-600 font-medium">Free</span>
                      : <span>{formatCurrency(shipping, "AED")}</span>}
                  </div>
                  <div className="border-t border-border pt-2.5 flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(orderTotal, "AED")}</span>
                  </div>
                </div>

                {/* Promo code */}
                {!promoApplied ? (
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value); setPromoError(""); }}
                        placeholder="Promo code"
                        className="flex-1 h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button type="button" onClick={applyPromo} className="px-3 h-9 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" /> Apply
                      </button>
                    </div>
                    {promoError && <p className="text-xs text-destructive mt-1">{promoError}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Try: AVENICK10</p>
                  </div>
                ) : (
                  <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
                    <Tag className="h-3.5 w-3.5" />
                    <span className="font-medium">10% discount applied!</span>
                    <button type="button" onClick={() => { setPromoApplied(false); setPromoCode(""); }} className="ms-auto text-xs underline">Remove</button>
                  </div>
                )}

                <Button asChild variant="primary" size="lg" className="w-full mb-3">
                  <Link href="/checkout">Proceed to Checkout <ArrowRight className="ms-2 h-4 w-4" /></Link>
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                  <span>Secure checkout · SSL encrypted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
