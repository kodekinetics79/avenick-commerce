"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { useCartStore } from "@/stores/cart";
import { toCardRow } from "@/lib/product-card-row";
import { CartDrawer } from "./cart-drawer";
import type { CartCompletionRow, CartCompletionsLoader } from "./completions";

/**
 * The drawer, wired to its "you might also need" source.
 *
 * A separate client component rather than a prop on the layout, for one hard
 * reason: MainLayout renders on the server, and a loader is a FUNCTION. A
 * function cannot cross the server/client boundary — React tries to serialise
 * it and the page 500s with "Functions cannot be passed directly to Client
 * Components", the same fault that took the seller's settings page down. So
 * the function is born on the client side of the line, here, and the layout
 * mounts this instead.
 *
 * The loader asks /api/cart/completions with the basket's ids and its channel.
 * The channel matters: a B2B basket must be completed with B2B-priced rows
 * and a consumer basket must never be shown B2B pricing, and the route runs
 * every row through the same price-privacy DTO the catalogue uses. Rows come
 * back in card shape via toCardRow, so the drawer and the cart page render
 * real ProductCards. Any failure resolves to an empty list — a missing rail is
 * a missing rail, never a broken drawer.
 */
export function CartDrawerConnected() {
  const locale = useLocale() as "en" | "ar";
  const items = useCartStore((s) => s.items);
  const currency = useCartStore((s) => s.currency);
  const b2b = items.some((line) => line.channel === "B2B");

  const loadCompletions = useCallback<CartCompletionsLoader>(
    async (productIds) => {
      if (productIds.length === 0) return [];
      try {
        const res = await fetch("/api/cart/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds, b2b, currency }),
        });
        if (!res.ok) return [];
        const json = (await res.json()) as { success?: boolean; data?: unknown[]; basis?: unknown };
        if (!json?.success || !Array.isArray(json.data)) return [];
        // The basis rides on every row rather than in a second store slot:
        // one response, one claim, and the drawer reads it off whichever row
        // survives the not-in-cart filter.
        const basis = json.basis === "co-purchase" || json.basis === "related" ? json.basis : undefined;
        return json.data.map((dto) => ({ ...(toCardRow(dto, locale) as CartCompletionRow), ...(basis ? { basis } : {}) }));
      } catch {
        return [];
      }
    },
    [b2b, currency, locale],
  );

  return <CartDrawer loadCompletions={loadCompletions} />;
}
