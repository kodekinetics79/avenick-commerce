"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
  sku: string;
  qty: number;
  unitPrice: number;
  vatRate?: number;
  sellerId: string;
  currency: string;
}

interface CartStore {
  items: CartItem[];
  currency: string;
  addItem: (item: Omit<CartItem, "id"> & { id?: string }) => void;
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
}

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
            return { items: state.items.map((i) => `${i.productId}-${i.variantId ?? ""}` === key ? { ...i, qty: i.qty + item.qty } : i) };
          }
          return { items: [...state.items, { ...item, id: item.id ?? key }] };
        });
      },

      updateQty: (id, qty) => {
        if (qty <= 0) { get().removeItem(id); return; }
        set((state) => ({ items: state.items.map((i) => i.id === id ? { ...i, qty } : i) }));
      },

      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    { name: "avenick-cart" }
  )
);
