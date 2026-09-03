"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, Trash2, ArrowRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MainLayout } from "@/components/layout/main-layout";
import {
  AvailabilityDot, Button, CommitBadge, CommitLabel, EmptyState, Eyebrow, LightGrid,
  PageHeader, PriceStack, SkeletonProductGrid, Surface,
} from "@avenick/ui";
import { toWishlistCartLine, useWishlist, wishlistItemKey, type WishlistItem } from "@/stores/wishlist";
import { useCartStore } from "@/stores/cart";
import { formatCurrency } from "@avenick/utils";
import { storefrontProductHref } from "@/lib/product-card-commerce";
import type { Currency } from "@/lib/market-context";
import { copyFrom, LineFrame, type Copy } from "../cart/_money-path";

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
function savedPrice(item: { price: number; currency: string }, locale: "ar" | "en"): string {
  if (!Number.isFinite(item.price)) return "—";
  return formatCurrency(item.price, item.currency as Currency, locale);
}

/** One name, in the language the page is set in — see the cart's lineName. */
const savedName = (item: Pick<WishlistItem, "nameEn" | "nameAr">, locale: string) =>
  (locale === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr);

/**
 * ONE SAVED PRODUCT.
 *
 * The card is a shelf item, not a search result, and three things do the work:
 *
 * THE FRAME. 4:5 portrait, object-fit CONTAIN, 9% inset, on the same tinted
 * plate with the same cast floor under the product and the same overhead light
 * on the plate's upper shoulder as every other product image in all three
 * portals. Round one used aspect-square + object-cover, which crops the valve
 * off a fitting and the label off a drum — on seller-supplied photography that
 * is the single largest cheapness generator in the product. On hover the
 * product lifts 1.5% off its floor and grows 3.5% WHILE THE FLOOR STAYS PUT,
 * which is what makes it read as an object rather than a picture.
 *
 * THE COMMIT. Pressing "Add to cart" does not flash and forget. The label wipes
 * — a clip-path edge travels from the inline start and reveals the confirmed
 * label underneath, both layers at full opacity the whole time, so no frame of
 * the word is ever half-transparent on the one control the buyer is watching.
 * The row's state has already changed; the motion only reports it.
 *
 * THE HONEST STATE, and round one's decision is kept rather than reversed.
 * `inStock` is a SNAPSHOT: nothing re-checks it until the product page is
 * opened, and a line saved from the cart is written with `inStock: true`
 * unconditionally, because a cart line carries no stock fact at all. So there
 * is deliberately NO AFFIRMATIVE MARK here. The dot only ever withholds — red
 * for a product recorded as unavailable, and otherwise the system's
 * UNCONFIRMED grey saying, in words, that availability has not been checked
 * since. A green lamp reading "Available" over a flag nobody verified is a
 * fabricated trust signal, which is the one unsurvivable failure; the dot is
 * still there in every card so the grid keeps its rhythm.
 */
function SavedCard({
  item, locale, c, onAdd, onRemove,
}: {
  item: WishlistItem;
  locale: "ar" | "en";
  c: Copy;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const [added, setAdded] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => () => clearTimeout(timer.current), []);

  const name = savedName(item, locale);
  const href = storefrontProductHref(item.slug, {
    currency: item.currency,
    b2b: item.channel === "B2B",
    variantId: item.variantId,
    quantity: item.quantity,
  });

  function add() {
    onAdd();
    setAdded(true);
    // The confirmed label is a readout that has to be legible, not a flash. It
    // returns to rest on its own so a buyer who adds four things in a row does
    // not end up with four cards permanently claiming "Added".
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2200);
  }

  return (
    <li>
      {/* interactive + specular + focusLift: the card is clickable, so it earns
          the elevation cross-fade, and the pointer light it shows is fed by the
          ONE listener <LightGrid> holds on the grid container — not by a
          listener of its own. */}
      <Surface
        rung={2}
        as="article"
        interactive
        specular
        focusLift
        className="group flex h-full flex-col overflow-hidden"
      >
        <Link
          href={href}
          // The title below is the same link. Exposing it twice makes a screen
          // reader read every card's name twice and doubles the tab stops in the
          // grid, so the image is decorative.
          aria-hidden="true"
          tabIndex={-1}
          className="block"
        >
          <LineFrame
            width="w-full"
            // Flush with the top edge of the card, so no radius: a nested corner
            // here leaves a sliver of card showing above the photograph.
            radius="none"
            sku={item.sku}
            state={item.inStock ? "available" : "out"}
          >
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
            ) : undefined}
          </LineFrame>
        </Link>

        <div className="relative z-10 flex flex-1 flex-col p-4">
          {/* The eyebrow names the supplier when the row recorded one. It is
              left out entirely rather than filled in: a placeholder here reads
              as "sold by the platform", which is never true of a listing. */}
          {item.sellerName && <Eyebrow className="truncate">{item.sellerName}</Eyebrow>}

          <h2 className="u-ui mt-1 min-h-[2.5rem] font-medium leading-snug">
            <Link href={href} className="u-focus line-clamp-2 rounded-nested text-ink-1 transition-colors duration-press ease-standard hover:text-primary-ink">
              {name}
            </Link>
          </h2>

          <p className="u-mono u-meta mt-1 text-ink-3">{item.sku}</p>

          {/* fig-card rank, money in ink. "From" is a qualifier BESIDE the
              figure, never baked into the string — baked in it renders at the
              figure's own rank and collapses the 3× ratio at exactly the place a
              shopper looks first. */}
          <PriceStack
            className="mt-2"
            amount={savedPrice(item, locale)}
            qualifier={item.priceTiered ? c("wishlist.from", "From") : undefined}
          />

          {/* One stock language across three portals, and the label carries the
              state in words: colour is never the only channel. UNCONFIRMED, not
              IN_STOCK — see THE HONEST STATE above. */}
          <AvailabilityDot
            className="mt-2"
            state={item.inStock ? "UNCONFIRMED" : "OUT_OF_STOCK"}
            label={
              item.inStock
                ? c("wishlist.availabilityUnchecked", "Availability not re-checked")
                : c("wishlist.unavailableWhenSaved", "Unavailable when saved")
            }
          />

          {/* mt-auto so every card's actions sit on one line across the row,
              whatever the length of the product name. */}
          <div className="mt-auto flex gap-2 pt-3">
            {/* Secondary, not primary: the primary FILL budget is one per view,
                and twenty indigo buttons in a grid is exactly how that budget
                gets spent on nothing. The card is still raised, so it still
                reads as actionable. */}
            <Button size="sm" variant="secondary" className="flex-1" disabled={!item.inStock} onClick={add}>
              <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
              <CommitLabel
                idle={c("wishlist.addToCart", "Add to cart")}
                committed={c("wishlist.added", "In your cart")}
                done={added}
              />
            </Button>
            <button
              type="button"
              aria-label={c("wishlist.removeNamed", `Remove ${name} from the wishlist`, { name })}
              onClick={onRemove}
              className="u-focus grid h-control-sm w-control-sm shrink-0 place-items-center rounded-nested border border-border text-ink-3 transition-colors duration-press ease-standard hover:bg-danger-soft hover:text-danger-ink"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Surface>
    </li>
  );
}

export default function WishlistPage() {
  const { items, remove } = useWishlist();
  const addItem = useCartStore((s) => s.addItem);
  const t = useTranslations();
  const c = copyFrom(t);
  const locale = useLocale() === "ar" ? "ar" : "en";
  const addable = items.filter((i) => i.inStock).length;
  // The count of lines the last "add everything" actually put in the cart, and
  // a press counter beside it. The COUNT is what the badge states; the SEQ is
  // what re-keys the pulse — a CSS animation restarts from zero only if the
  // element remounts, and keying on the count alone meant a second press with
  // the same count re-keyed nothing and the buyer got no acknowledgement at all
  // for a press that did change the cart.
  const [addedBatch, setAddedBatch] = React.useState<{ count: number; seq: number } | null>(null);
  // The wishlist is persisted in localStorage, which the server cannot read, so
  // the first render on both sides is empty. Without this gate a buyer with
  // twenty saved products is shown the certificate — "Your wishlist is empty" —
  // for a frame before their tiles arrive. The skeleton is the real frame with
  // the shimmer only where the photograph will be, so the grid does not
  // reassemble itself when the store rehydrates.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  function addToCart(item: WishlistItem) {
    addItem(toWishlistCartLine(item));
  }

  function addAllToCart() {
    const batch = items.filter((i) => i.inStock);
    batch.forEach(addToCart);
    setAddedBatch((previous) => ({ count: batch.length, seq: (previous?.seq ?? 0) + 1 }));
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-block">
        <PageHeader
          eyebrow={c("wishlist.eyebrow", "Saved")}
          title={c("wishlist.title", "Wishlist")}
          // LAW E. A wishlist line is a snapshot: the price and the availability
          // are the ones captured when it was saved, and neither is re-checked
          // until the product page is opened. Saying so is what lets the cards
          // below stop making a claim they cannot support.
          dateline={c(
            "wishlist.dateline",
            "Saved in this browser · price and availability as recorded when each was saved",
          )}
          actions={
            hydrated && items.length > 0 ? (
              <Button variant="primary" size="sm" onClick={addAllToCart} disabled={addable === 0}>
                <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                {c("wishlist.addAll", `Add ${addable} to cart`, { count: addable })}
              </Button>
            ) : undefined
          }
        />

        {addedBatch != null && (
          // The same strip the cart uses to report a removal, for the same
          // reason: an action that changes something on ANOTHER page has to say
          // so where it happened, and offer the way there. The CONTAINER
          // springs 1 → 1.18 → 1; the digit inside is swapped instantly and
          // never animated. On a trade platform a count that ticks is a count
          // you cannot trust.
          <Surface
            rung={1}
            role="status"
            className="u-pop mb-stack flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <p className="u-ui flex min-w-0 items-center gap-2 text-ink-2">
              <CommitBadge pulseKey={addedBatch.seq} className="fig font-medium text-ink-1">
                {addedBatch.count}
              </CommitBadge>
              <span className="truncate">
                {c("wishlist.addedToCart", "added to your cart", { count: addedBatch.count })}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/cart">{c("wishlist.viewCart", "View cart")}</Link>
              </Button>
              <button
                type="button"
                aria-label={c("wishlist.dismiss", "Dismiss")}
                onClick={() => setAddedBatch(null)}
                className="u-focus grid h-control-sm w-control-sm place-items-center rounded-nested text-ink-3 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </Surface>
        )}

        {!hydrated ? (
          // The column counts are restated so the skeleton grid is byte-for-byte
          // the real grid: a placeholder that lays out differently from the
          // thing it stands in for is a layout shift with extra steps.
          <SkeletonProductGrid count={4} className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />
        ) : items.length === 0 ? (
          /* THE CERTIFICATE. The heart glyph is cropped off the outer corner —
             inset-inline-end, so it crops from the correct corner in Arabic
             with no second rule — and the lead sentence is set in the
             provenance voice. It is not wrapped in a card: the certificate IS
             the plate, and nesting it in a Surface gave it a box around a box. */
          <EmptyState
            // The certificate is the same plate at the same measure on all four
            // money-path surfaces; the page container around it is wider here
            // because the grid it replaces is.
            className="max-w-4xl"
            variant="certificate"
            eyebrow={c("wishlist.empty.eyebrow", "Nothing saved")}
            headline={c("wishlist.empty.headline", "Your wishlist is empty.")}
            body={c(
              "wishlist.empty.body",
              "The heart on any product saves it here, with the price and availability recorded at that moment.",
            )}
            glyph={<Heart aria-hidden="true" />}
            action={
              <Button asChild variant="primary" size="lg">
                <Link href="/products">
                  {c("wishlist.browse", "Browse products")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        ) : (
          /* ONE pointermove listener for the whole grid rather than one per
             card. Twenty-four handlers each doing their own rAF write is the
             mid-range-Android jank the performance law names, and it is the
             obvious implementation. <LightGrid> early-RETURNS before attaching
             on a coarse pointer, under reduced motion and under Save-Data, so a
             phone registers nothing at all. */
          <LightGrid>
            <ul className="grid grid-cols-1 gap-stack sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <SavedCard
                  key={wishlistItemKey(item.id, item.variantId)}
                  item={item}
                  locale={locale}
                  c={c}
                  onAdd={() => addToCart(item)}
                  onRemove={() => remove(item.id, item.variantId)}
                />
              ))}
            </ul>
          </LightGrid>
        )}
      </div>
    </MainLayout>
  );
}
