"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@avenick/utils";
import { Button, CommitLabel, ImageFrame } from "@avenick/ui";
import type { Currency } from "@/lib/market-context";
import { storefrontProductHref } from "@/lib/product-card-commerce";
import { useCartStore } from "@/stores/cart";
import { useCartDrawerStore } from "./cart-drawer-store";
import { cartLineFromCompletion, completionAction, type CartCompletionRow } from "./completions";

/**
 * One recommendation, at drawer density.
 *
 * The catalogue tile is a 4:5 frame, a rating, a ladder and a full-width key
 * — it is built to read at 5-up across a page, and inside a 26rem panel it
 * would be one tile per screen. This is the same record at list rank: the
 * SAME <ImageFrame> on the same lit plate (so a photographed product and an
 * unphotographed one occupy the identical box), the name as the link, the
 * price with its VAT basis stated, the MOQ when it is not one, and the one
 * control the product card would have offered — decided by `completionAction`,
 * which is the card's own decision restated, so a row here and the tile in the
 * grid never disagree.
 *
 * Adding from a row keeps the drawer open and makes the new line the featured
 * one. No navigation, which is the whole point of the drawer.
 *
 * The control is a SECONDARY fill: the drawer's one primary is "Checkout",
 * and a column of primaries under it would leave nothing on the panel reading
 * as the call to action.
 */
export interface CompletionRowProps {
  row: CartCompletionRow;
  channel: "B2C" | "B2B";
  locale: "en" | "ar";
  /** Called before any link in the row navigates, so the drawer can close. */
  onNavigate?: () => void;
}

export function CompletionRow({ row, channel, locale, onNavigate }: CompletionRowProps) {
  const tc = useTranslations("catalogue");
  const tp = useTranslations("products");
  const addItem = useCartStore((s) => s.addItem);
  const openFor = useCartDrawerStore((s) => s.openFor);
  const nameId = React.useId();

  // The same readout the product card gives: the line is in the cart the
  // instant this runs, the label wipes to "Added" and returns to rest on its
  // own. Nothing is gated; a second press adds again and restarts the readout.
  const [committed, setCommitted] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => () => clearTimeout(timer.current), []);

  const name = locale === "ar" ? row.nameAr || row.nameEn : row.nameEn || row.nameAr;
  const href = storefrontProductHref(row.slug, { currency: row.currency, b2b: channel === "B2B" });
  const action = completionAction(row, channel);
  const money =
    row.price != null && row.currency ? formatCurrency(row.price, row.currency as Currency, locale) : null;
  const moq = Number.isInteger(row.moq) && (row.moq as number) > 1 ? (row.moq as number) : 1;
  const availability = row.availabilityStatus ?? (row.inStock ? "IN_STOCK" : "OUT_OF_STOCK");

  function add() {
    const line = cartLineFromCompletion(row, channel);
    if (!line) return;
    addItem(line);
    // The card only forwards bands on a B2B tile; the row keeps the same gate.
    openFor({ productId: row.id, priceBands: channel === "B2B" ? row.priceBands : undefined });
    clearTimeout(timer.current);
    setCommitted(true);
    timer.current = setTimeout(() => setCommitted(false), 1800);
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={href} aria-hidden="true" tabIndex={-1} onClick={onNavigate} className="block shrink-0">
        <ImageFrame
          sku={row.sku}
          state={availability === "OUT_OF_STOCK" ? "out" : availability === "UNCONFIRMED" ? "unconfirmed" : "available"}
          className="w-14 overflow-hidden rounded-nested"
        >
          {row.imageUrl ? <Image src={row.imageUrl} alt="" fill sizes="56px" /> : undefined}
        </ImageFrame>
      </Link>

      <div className="min-w-0 flex-1">
        <h4 className="u-ui font-medium">
          <Link
            id={nameId}
            href={href}
            onClick={onNavigate}
            className="u-focus line-clamp-2 rounded-nested text-ink-1 transition-colors duration-press ease-standard hover:text-primary-ink"
          >
            {name}
          </Link>
        </h4>
        {/* The price line states its basis. A bare figure a consumer reads as
            the amount they will pay, when it is VAT-exclusive, is the quiet
            untruth this storefront does not print. */}
        <p className="u-meta text-ink-3">
          {money ? (
            <>
              {row.priceIsFrom && <>{tc("from")} </>}
              <span className="fig text-ink-2">{money}</span>
              {row.vatRate != null && <> · {tc("vatExcl", { rate: String(row.vatRate) })}</>}
            </>
          ) : (
            tc("quoteOnRequest")
          )}
        </p>
        {moq > 1 && (
          <p className="u-meta text-ink-3">{tc("minOrder", { count: moq, qty: String(moq) })}</p>
        )}
      </div>

      <div className="shrink-0">
        {action.kind === "ADD_TO_CART" ? (
          // The visible label stays the accessible name (a voice-control user
          // says what they see); the product it acts on is the description.
          <Button type="button" variant="secondary" size="sm" onClick={add} aria-describedby={nameId}>
            <CommitLabel idle={tp("addToCart")} committed={tc("added")} done={committed} />
          </Button>
        ) : (
          <Button asChild variant="secondary" size="sm">
            <Link href={action.href} onClick={onNavigate} aria-describedby={nameId}>
              {action.kind === "SELECT_VARIANT"
                ? tp("selectOptions")
                : action.kind === "REQUEST_AVAILABILITY"
                  ? tp("requestAvailability")
                  : tp("requestQuote")}
            </Link>
          </Button>
        )}
        {/* A label that changes is not announced; the fact is said in words. */}
        <p role="status" className="sr-only">
          {committed ? tc("addedAnnouncement", { name }) : ""}
        </p>
      </div>
    </li>
  );
}
