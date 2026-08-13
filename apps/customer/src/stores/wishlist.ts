"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WishlistItem {
  id: string;
  slug: string;
  variantId?: string;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
  price: number;
  quantity?: number;
  moq?: number;
  vatRate?: number;
  currency: string;
  sku: string;
  sellerId: string;
  sellerName?: string;
  inStock: boolean;
}

interface WishlistStore {
  items: WishlistItem[];
  toggle: (item: WishlistItem) => void;
  has: (id: string, variantId?: string) => boolean;
  remove: (id: string, variantId?: string) => void;
  clear: () => void;
}

export const wishlistItemKey = (id: string, variantId?: string) => `${id}-${variantId ?? ""}`;

export function toWishlistCartLine(item: WishlistItem) {
  return {
    productId: item.id,
    slug: item.slug,
    variantId: item.variantId,
    nameEn: item.nameEn,
    nameAr: item.nameAr,
    imageUrl: item.imageUrl,
    sku: item.sku,
    qty: item.quantity ?? 1,
    moq: item.moq ?? 1,
    unitPrice: item.price,
    vatRate: item.vatRate,
    sellerId: item.sellerId,
    currency: item.currency,
  };
}

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (item) =>
        set((s) =>
          s.items.some((i) => wishlistItemKey(i.id, i.variantId) === wishlistItemKey(item.id, item.variantId))
            ? { items: s.items.filter((i) => wishlistItemKey(i.id, i.variantId) !== wishlistItemKey(item.id, item.variantId)) }
            : { items: [...s.items, item] }
        ),
      has: (id, variantId) => get().items.some((i) => wishlistItemKey(i.id, i.variantId) === wishlistItemKey(id, variantId)),
      remove: (id, variantId) => set((s) => ({ items: s.items.filter((i) => wishlistItemKey(i.id, i.variantId) !== wishlistItemKey(id, variantId)) })),
      clear: () => set({ items: [] }),
    }),
    { name: "avenick-wishlist" }
  )
);
