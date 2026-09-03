"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, Trash2, PackageSearch } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Button, EmptyState, Num, PageHeader, SpecularSurface, StatusPill, Surface,
} from "@avenick/ui";
import { toWishlistCartLine, useWishlist, wishlistItemKey } from "@/stores/wishlist";
import { useCartStore } from "@/stores/cart";
import { formatCurrency } from "@avenick/utils";
import { storefrontProductHref } from "@/lib/product-card-commerce";
import type { Currency } from "@/lib/market-context";

/**
 * A saved line's price, or an em dash.
 *
 * Same reason as the cart's lineMoney: formatCurrency hands a non-finite amount
 * to Intl.NumberFormat, which renders it as the literal string "NaN". A
 * wishlist row is persisted in the browser and can outlive the shape that wrote
 * it, so the figure has to be able to withhold itself. Display only — the row
 * still adds to the cart, where the missing fact is named on the line and the
 * checkout button refuses.
 */
function savedPrice(item: { price: number; currency: string }): string {
  if (!Number.isFinite(item.price)) return "—";
  return formatCurrency(item.price, item.currency as Currency);
}

export default function WishlistPage() {
  const { items, remove } = useWishlist();
  const addItem = useCartStore((s) => s.addItem);
  const addable = items.filter((i) => i.inStock).length;

  function addToCart(item: typeof items[0]) {
    addItem(toWishlistCartLine(item));
  }

  function addAllToCart() {
    items.filter((i) => i.inStock).forEach(addToCart);
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-block">
        <PageHeader
          eyebrow="Saved"
          title="Wishlist"
          // LAW E. A wishlist line is a snapshot: the price and the availability
          // are the ones captured when it was saved, and neither is re-checked
          // until the product page is opened. Saying so is what lets the cards
          // below stop making a claim they cannot support.
          dateline={`${items.length} item${items.length !== 1 ? "s" : ""} saved in this browser · price and availability as recorded when each was saved`}
          actions={
            items.length > 0 ? (
              <Button variant="primary" size="sm" onClick={addAllToCart} disabled={addable === 0}>
                <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                Add {addable} to cart
              </Button>
            ) : undefined
          }
        />

        {items.length === 0 ? (
          <Surface rung={2}>
            <EmptyState
              eyebrow="Nothing saved"
              headline="Your wishlist is empty."
              body="The heart on any product saves it here, with the price and availability recorded at that moment."
              icon={<Heart className="h-3.5 w-3.5" aria-hidden="true" />}
              action={<Button asChild variant="primary"><Link href="/products">Browse products</Link></Button>}
            />
          </Surface>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
              const href = storefrontProductHref(item.slug, { currency: item.currency, b2b: item.channel === "B2B", variantId: item.variantId, quantity: item.quantity });
              return (
                <li key={wishlistItemKey(item.id, item.variantId)}>
                  {/* The surviving half of the tilt idea: a pointer-tracked
                      specular reads as real material for one composited paint,
                      and it cannot be turned up too far. It never attaches on a
                      coarse pointer or under reduced motion. */}
                  <SpecularSurface className="h-full">
                    <Surface rung={2} as="article" interactive specular className="group flex h-full flex-col overflow-hidden">
                      <Link
                        href={href}
                        // The title below is the same link. Exposing it twice makes
                        // a screen reader read every card's name twice and doubles
                        // the tab stops in the grid, so the image is decorative.
                        aria-hidden="true"
                        tabIndex={-1}
                        className="relative block aspect-square overflow-hidden bg-surface-1"
                      >
                        {item.imageUrl ? (
                          // 1.03 rather than 1.10: a large scale is an expensive
                          // repaint across a grid, and it crops the product.
                          // motion-reduce holds it at 1: the global reduce block
                          // only collapses DURATIONS, so without this the image
                          // still jumps 3% — instantly, which is worse than the
                          // animation it was meant to suppress.
                          <Image src={item.imageUrl} alt="" fill className="object-cover transition-transform duration-layer ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100" sizes="(max-width: 768px) 50vw, 25vw" />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-ink-3">
                            <PackageSearch className="h-10 w-10 opacity-30" aria-hidden="true" />
                          </span>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col p-4">
                        {item.sellerName && <p className="mb-0.5 truncate text-meta text-ink-3">{item.sellerName}</p>}
                        <h2 className="mb-2 min-h-[2.5rem] text-ui font-medium leading-snug">
                          <Link href={href} className="u-focus line-clamp-2 rounded-nested text-ink-1 transition-colors duration-press ease-standard hover:text-primary-ink">
                            {item.nameEn}
                          </Link>
                        </h2>

                        {/* Money is ink at figure rank. There is deliberately no
                            affirmative "In Stock" mark: the flag is a snapshot
                            taken at save time, so the only honest thing to show is
                            the one that withholds the item. */}
                        <Num value={savedPrice(item)} />

                        {!item.inStock && (
                          <StatusPill tone="warning" dot className="mt-2 self-start">Unavailable when saved</StatusPill>
                        )}

                        {/* mt-auto so every card's actions sit on one line across
                            the row, whatever the length of the product name. */}
                        <div className="mt-auto flex gap-2 pt-3">
                          {/* Secondary, not primary: the primary FILL budget is one
                              per view, and twenty indigo buttons in a grid is
                              exactly how that budget gets spent on nothing. The
                              card is still raised, so it still reads as actionable. */}
                          <Button size="sm" variant="secondary" className="flex-1" disabled={!item.inStock} onClick={() => addToCart(item)}>
                            <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                            Add to cart
                          </Button>
                          <button
                            type="button"
                            aria-label={`Remove ${item.nameEn} from the wishlist`}
                            onClick={() => remove(item.id, item.variantId)}
                            className="u-focus grid h-control-sm w-control-sm shrink-0 place-items-center rounded-nested border border-border text-ink-3 transition-colors duration-press ease-standard hover:bg-danger-soft hover:text-danger-ink"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </Surface>
                  </SpecularSurface>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </MainLayout>
  );
}
