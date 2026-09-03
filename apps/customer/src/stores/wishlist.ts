"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WishlistItem {
  id: string;
  slug: string;
  channel?: "B2C" | "B2B";
  variantId?: string;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
  price: number;
  quantity?: number;
  moq?: number;
  vatRate?: number;
  /**
   * Whether `price` came from one of several quantity bands in this currency.
   * Carried through to the cart line so a later quantity change is repriced
   * by the product page rather than edited against a tier that may no longer
   * apply — see CartItem.priceTiered.
   */
  priceTiered?: boolean;
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
    channel: item.channel,
    variantId: item.variantId,
    nameEn: item.nameEn,
    nameAr: item.nameAr,
    imageUrl: item.imageUrl,
    sku: item.sku,
    qty: item.quantity ?? 1,
    moq: item.moq ?? 1,
    unitPrice: item.price,
    vatRate: item.vatRate,
    priceTiered: item.priceTiered,
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
