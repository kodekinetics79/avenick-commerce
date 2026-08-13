"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
}

export const cartQuantityChangeHref = (item: Pick<CartItem, "slug" | "currency" | "channel" | "variantId" | "qty">) => item.slug
  ? `/products/${item.slug}?${new URLSearchParams({
      currency: item.currency,
      ...(item.channel === "B2B" ? { b2b: "true" } : {}),
      ...(item.variantId ? { variantId: item.variantId } : {}),
      qty: String(item.qty),
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
      currency: "AED",

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

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    { name: "avenick-cart" }
  )
);
