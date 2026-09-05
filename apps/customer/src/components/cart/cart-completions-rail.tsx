"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { SectionHeader } from "@avenick/ui";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid } from "@/components/products/product-grid";
import type { CartItem } from "@/stores/cart";
import { completionsNotInCart, type CartCompletionRow } from "./completions";

/**
 * "Complete your order" — the cart page's selling rail.
 *
 * It renders the catalogue's OWN tile in the catalogue's own grid, so a product
 * suggested here is the identical object the buyer met on /products: same
 * frame, same price block with its VAT basis, same ladder on a B2B tile, same
 * one control — whose add now opens the drawer over this page rather than
 * reloading it. Nothing is re-derived; the rows arrive already shaped by
 * `toCardRow`.
 *
 * Rows already in the cart are dropped here, not upstream, because only this
 * browser knows what is in the cart. When nothing is left the rail is absent:
 * no heading, no empty plate, no filler.
 *
 * `reason` is the one sentence allowed under the heading, and it must be the
 * signal that produced the rows ("often ordered with these lines"), passed in
 * already localised by whoever fetched them. Nothing is claimed when it is
 * absent — a rail cannot vouch for a ranking it did not compute.
 */
export interface CartCompletionsRailProps {
  rows: readonly CartCompletionRow[];
  cartItems: readonly Pick<CartItem, "productId">[];
  /** The cart's sales channel; a B2B cart is shown B2B tiles with their ladders. */
  channel: "B2C" | "B2B";
  locale: "en" | "ar";
  reason?: string;
  className?: string;
}

export function CartCompletionsRail({ rows, cartItems, channel, locale, reason, className }: CartCompletionsRailProps) {
  const t = useTranslations("cart");
  const visible = completionsNotInCart(rows, cartItems);
  if (visible.length === 0) return null;
  const isB2B = channel === "B2B";

  return (
    <section aria-label={t("completions.title")} className={className}>
      <SectionHeader title={t("completions.title")} count={visible.length} dateline={reason} />
      <ProductGrid columns={4}>
        {visible.map((row, i) => (
          <ProductCard
            key={row.id}
            {...row}
            priceTiered={row.priceTiered}
            // The card gates the ladder on isB2B itself; the bands are only
            // handed over on a B2B cart so a consumer cart cannot leak them.
            priceBands={isB2B ? row.priceBands : undefined}
            isB2B={isB2B}
            locale={locale}
            // The card prioritises the images of its first two tiles for the
            // LCP. This rail sits below the cart lines, never above the fold,
            // so no tile here may claim that priority.
            index={i + 2}
          />
        ))}
      </ProductGrid>
    </section>
  );
}
