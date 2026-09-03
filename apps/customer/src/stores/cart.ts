"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultStorefrontCurrency } from "@/lib/market-context";

export interface CartItem {
  id: string;
  productId: string;
  slug?: string;
  channel?: "B2C" | "B2B";
  variantId?: string;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
  sku: string;
  qty: number;
  moq?: number;
  /**
   * True when the unit price captured on this line came from a quantity tier
   * (the product or variant publishes more than one price band in this
   * currency), so a different quantity may resolve to a different price.
   * Written at add time by the product page, the list card and the wishlist
   * (each from its own catalog projection); absent on lines added elsewhere.
   */
  priceTiered?: boolean;
  unitPrice: number;
  vatRate?: number;
  sellerId: string;
  currency: string;
}

interface CartStore {
  items: CartItem[];
  currency: string;
  addItem: (item: Omit<CartItem, "id"> & { id?: string }) => void;
  removeItem: (id: string) => void;
  /**
   * Set a line's quantity in place. Clamped to [moq ?? 1, CART_QTY_MAX]; a
   * non-integer is ignored. Only meaningful for lines whose unit price does
   * not depend on quantity — see cartLineNeedsRepricing for why tiered lines
   * must not be changed this way.
   */
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
}

/**
 * Upper bound for the cart stepper (the brief's limit for the in-cart
 * control). It is deliberately below the checkout API's per-line cap, so a
 * quantity the stepper allows is never one the order endpoint would refuse
 * on size alone; larger B2B volumes go through RFQ / purchase orders.
 */
export const CART_QTY_MAX = 9999;

/** The inclusive quantity range a line may take from the cart stepper. */
export const cartQuantityBounds = (item: Pick<CartItem, "moq">) => ({
  min: Math.max(1, Number.isInteger(item.moq) ? (item.moq as number) : 1),
  max: CART_QTY_MAX,
});

/**
 * Whether a quantity change on this line must go back through the product
 * page. B2B unit prices are tiered by quantity as a rule; a B2C price can be
 * tiered too when the seller published more than one band, which the product
 * page records as `priceTiered`. Editing such a line in place would keep the
 * old tier's price against a quantity that may not qualify for it — a total
 * the server never charges, i.e. a silent wrong answer.
 */
export const cartLineNeedsRepricing = (item: Pick<CartItem, "channel" | "priceTiered">) =>
  item.channel === "B2B" || item.priceTiered === true;

/**
 * Link back to the product page with the line's commercial selection, and
 * optionally a different target quantity. Lines flagged by
 * cartLineNeedsRepricing change quantity through this link so the product page
 * re-resolves the tier from the catalog before the line is replaced.
 */
export const cartQuantityChangeHref = (item: Pick<CartItem, "slug" | "currency" | "channel" | "variantId" | "qty">, qty = item.qty) => item.slug
  ? `/products/${item.slug}?${new URLSearchParams({
      currency: item.currency,
      ...(item.channel === "B2B" ? { b2b: "true" } : {}),
      ...(item.variantId ? { variantId: item.variantId } : {}),
      qty: String(qty),
    }).toString()}`
  : "/products";
export const replaceCartCommercialSelection = (existing: CartItem, selected: Omit<CartItem, "id"> & { id?: string }): CartItem => ({
  ...selected,
  id: existing.id,
});

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      currency: defaultStorefrontCurrency(),

      addItem: (item) => {
        const key = `${item.productId}-${item.variantId ?? ""}`;
        set((state) => {
          const existing = state.items.find((i) => `${i.productId}-${i.variantId ?? ""}` === key);
          if (existing) {
            return { items: state.items.map((i) => `${i.productId}-${i.variantId ?? ""}` === key ? replaceCartCommercialSelection(i, item) : i) };
          }
          return { items: [...state.items, { ...item, id: item.id ?? key }] };
        });
      },

      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      setQty: (id, qty) => {
        if (!Number.isInteger(qty)) return;
        set((state) => ({
          items: state.items.map((i) => {
            if (i.id !== id) return i;
            // The refusal lives on the operation, not only on the cart page's
            // stepper: any other caller (a future quick-edit control, a test,
            // devtools) would otherwise keep a tier's unit price against a
            // quantity that may not qualify for it. Such lines change quantity
            // through cartQuantityChangeHref, which re-resolves the tier.
            if (cartLineNeedsRepricing(i)) return i;
            const { min, max } = cartQuantityBounds(i);
            return { ...i, qty: Math.min(max, Math.max(min, qty)) };
          }),
        }));
      },

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    { name: "avenick-cart" }
  )
);
