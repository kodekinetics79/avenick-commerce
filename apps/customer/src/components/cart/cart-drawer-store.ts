"use client";

import { create } from "zustand";
import type { ProductCardPriceBand } from "@/components/products/product-card";
import type { CartCompletionRow } from "./completions";

/**
 * The cart drawer's own state — deliberately NOT a field on the persisted cart.
 *
 * `useCartStore` is wrapped in `persist`, so anything written there comes back
 * on the next page load. A drawer flag that survives a reload is a drawer that
 * opens itself on page load, which is the one behaviour this surface must never
 * have. The line just added and the rows for "You might also need" have the
 * same lifetime as the open flag — they describe THIS session's last gesture,
 * not the cart — so they live here and start empty on every load.
 *
 * The cart store itself is untouched: the drawer reads the live line back out
 * of it by key, so the quantity stepper edits the real line and the subtotal is
 * the same arithmetic the cart page runs.
 */

/**
 * The cart store's own line identity, restated. `addItem` keys a line on
 * `${productId}-${variantId ?? ""}` and uses that as the line id when the
 * caller supplies none; the drawer needs the same key to find the line it was
 * just told about. `completions.test.ts` pins the two against each other.
 */
export const cartLineKey = (productId: string, variantId?: string | null) =>
  `${productId}-${variantId ?? ""}`;

export interface CartDrawerLastAdded {
  productId: string;
  variantId?: string;
  /**
   * The published quantity bands the line was added from, in the line's
   * currency — the card's `priceBands`, forwarded only when the tile was a B2B
   * tile. A B2B line must show the ladder its price came from, and the cart
   * line itself carries only the ONE unit price it was added at.
   */
  priceBands?: ProductCardPriceBand[];
}

interface CartDrawerState {
  open: boolean;
  /**
   * The element that had focus when the drawer opened — the add-to-cart
   * control — so focus can be handed back to it on close. Captured only on
   * a closed→open transition: an add from inside the drawer must not make
   * a row that is about to unmount the place focus returns to.
   */
  returnFocusTo: HTMLElement | null;
  /** `cartLineKey` of the line the drawer is featuring, or null before any add. */
  lastAddedKey: string | null;
  lastAddedBands: ProductCardPriceBand[] | null;
  /**
   * Rows for the two recommendation slots (the drawer's "You might also need"
   * and the cart page's "Complete your order"). Shaped by `toCardRow` on the
   * server or an API route — never fetched from a client component directly.
   * Empty means the slots are absent; nothing here ever pads them.
   */
  completions: CartCompletionRow[];
  /** Open the drawer featuring this line. Call AFTER `addItem`, never instead of it. */
  openFor: (line: CartDrawerLastAdded) => void;
  setOpen: (open: boolean) => void;
  setCompletions: (rows: CartCompletionRow[]) => void;
}

/** The focused element, or null when nothing meaningful holds focus. */
function activeControl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

export const useCartDrawerStore = create<CartDrawerState>()((set) => ({
  open: false,
  returnFocusTo: null,
  lastAddedKey: null,
  lastAddedBands: null,
  completions: [],

  openFor: ({ productId, variantId, priceBands }) =>
    set((state) => ({
      open: true,
      returnFocusTo: state.open ? state.returnFocusTo : activeControl(),
      lastAddedKey: cartLineKey(productId, variantId),
      lastAddedBands: priceBands && priceBands.length > 1 ? priceBands : null,
    })),

  // Closing keeps the featured line: the buyer may reopen from another add,
  // and there is nothing to forget. Only `openFor` ever changes it.
  setOpen: (open) => set({ open }),

  setCompletions: (rows) => set({ completions: Array.isArray(rows) ? rows : [] }),
}));
