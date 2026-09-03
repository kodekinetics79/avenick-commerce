"use client";

import Link from "next/link";
import Image from "next/image";
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, Heart, Minus, Plus } from "lucide-react";
import { Button } from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import { cartLineNeedsRepricing, cartQuantityBounds, cartQuantityChangeHref, useCartStore, type CartItem } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { MainLayout } from "@/components/layout/main-layout";
import { cartDestination, summarizeCartCommercial } from "@/lib/cart-commercial";

const STEP_BUTTON = "grid h-9 w-9 place-items-center transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent aria-disabled:opacity-40 aria-disabled:pointer-events-none";

/**
 * Quantity control for one cart line.
 *
 * A line with a flat unit price is edited in place and the row total follows.
 * A line whose unit price is quantity-tiered (every B2B line, and a B2C line
 * the product page flagged as tiered) was priced on the product page for the
 * quantity it holds: editing the quantity here while keeping that tier's price
 * would show a total the server will never charge, so its "−"/"+" are links to
 * the product page at the new quantity, where the tier is re-resolved before
 * the line is replaced.
 */
function QuantityStepper({ item, onSet }: { item: CartItem; onSet: (qty: number) => void }) {
  const { min, max } = cartQuantityBounds(item);
  const atMin = item.qty <= min;
  const atMax = item.qty >= max;
  const tiered = cartLineNeedsRepricing(item);

  if (tiered && !item.slug) {
    // A line persisted before slugs were stored cannot be repriced from here.
    return <span className="text-sm font-semibold">Qty {item.qty}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center border border-border rounded-xl overflow-hidden" role="group" aria-label={`Quantity for ${item.nameEn}`}>
        {tiered ? (
          <Link
            // Disabled links keep a harmless target (the current quantity) so an
            // assistive-tech activation can never request a quantity below the MOQ.
            href={cartQuantityChangeHref(item, atMin ? item.qty : item.qty - 1)}
            aria-disabled={atMin}
            tabIndex={atMin ? -1 : undefined}
            aria-label={`Reprice at ${item.qty - 1} units`}
            title={`Reprice at ${item.qty - 1} units on the product page`}
            className={STEP_BUTTON}
          >
            <Minus className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <button type="button" disabled={atMin} aria-label="Decrease quantity" onClick={() => onSet(item.qty - 1)} className={STEP_BUTTON}>
            <Minus className="h-3.5 w-3.5" />
          </button>
        )}
        <span className="px-3 text-sm font-semibold min-w-[2.5rem] text-center" aria-live="polite">{item.qty}</span>
        {tiered ? (
          <Link
            href={cartQuantityChangeHref(item, atMax ? item.qty : item.qty + 1)}
            aria-disabled={atMax}
            tabIndex={atMax ? -1 : undefined}
            aria-label={`Reprice at ${item.qty + 1} units`}
            title={`Reprice at ${item.qty + 1} units on the product page`}
            className={STEP_BUTTON}
          >
            <Plus className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <button type="button" disabled={atMax} aria-label="Increase quantity" onClick={() => onSet(item.qty + 1)} className={STEP_BUTTON}>
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {tiered && <span className="text-[11px] text-muted-foreground">Quantity-tiered price · repriced on the product page</span>}
      {!tiered && min > 1 && atMin && <span className="text-[11px] text-muted-foreground">Minimum {min}</span>}
    </div>
  );
}

export default function CartPage() {
  const { items, removeItem, setQty } = useCartStore();
  const { toggle } = useWishlist();
  const summary = summarizeCartCommercial(items);
  const destination = cartDestination(items);
  const subtotal = summary.valid ? summary.subtotal : 0;
  const orderTotal = summary.valid ? summary.total : 0;

  function saveForLater(item: typeof items[0]) {
    if (!item.slug) return;
    toggle({ id: item.productId, slug: item.slug, channel: item.channel, variantId: item.variantId, nameEn: item.nameEn, nameAr: item.nameAr, imageUrl: item.imageUrl, price: item.unitPrice, quantity: item.qty, moq: item.moq, vatRate: item.vatRate, currency: item.currency, sku: item.sku, sellerId: item.sellerId, inStock: true });
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
              <Button asChild variant="ghost" size="lg"><Link href="/brands">Shop by brand</Link></Button>
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
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 bg-white rounded-2xl border border-border p-4 hover:shadow-sm transition-shadow">
                  <Link href={cartQuantityChangeHref(item)} className="w-20 h-20 shrink-0 bg-secondary rounded-xl overflow-hidden relative border border-border">
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
                      <span className="font-bold text-primary shrink-0">{formatCurrency(item.unitPrice * item.qty, item.currency as never)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(item.unitPrice, item.currency as never)} each · VAT {item.vatRate ?? "—"}%</p>

                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      <QuantityStepper item={item} onSet={(qty) => setQty(item.id, qty)} />
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
                    <span>{summary.valid ? formatCurrency(subtotal, summary.currency as never) : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT</span>
                    <span>{summary.valid ? formatCurrency(summary.vatAmount, summary.currency as never) : "—"}</span>
                  </div>
                  <div className="border-t border-border pt-2.5 flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="text-primary">{summary.valid ? formatCurrency(orderTotal, summary.currency as never) : "—"}</span>
                  </div>
                </div>

                <p className="mb-4 text-xs text-muted-foreground">
                  Prices, VAT, availability and eligible coupon codes are re-validated and priced by the server during checkout.
                </p>

                {(!summary.valid || !destination.valid) && <p className="mb-3 text-xs text-destructive">Cart currency, VAT, or sales channel is inconsistent. Separate B2B and B2C items before continuing.</p>}
                {summary.valid && destination.valid ? <Button asChild variant="primary" size="lg" className="w-full mb-3">
                  <Link href={destination.href}>{destination.label} <ArrowRight className="ms-2 h-4 w-4" /></Link>
                </Button> : <Button variant="primary" size="lg" className="w-full mb-3" disabled>Checkout unavailable</Button>}
                {/*
                  This line used to say "SSL encrypted" — a property of the
                  deployment that this page cannot vouch for. What the code
                  does guarantee is server-side revalidation at order time.
                */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span>Price checked again when you place the order</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
