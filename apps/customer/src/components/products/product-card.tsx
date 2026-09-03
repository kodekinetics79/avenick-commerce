"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageSquare, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@avenick/utils";
import {
  AvailabilityDot,
  Button,
  CommitLabel,
  Eyebrow,
  ImageFrame,
  PriceStack,
  QuantityLadder,
  StatusPill,
  Surface,
} from "@avenick/ui";
import { useCartStore } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { productCardPricePresentation, productCardPurchaseAction, storefrontProductHref } from "@/lib/product-card-commerce";
import type { Currency } from "@/lib/market-context";

/** One published price band in the card's currency, straight off the list DTO. */
export interface ProductCardPriceBand {
  minQty: number;
  maxQty: number | null;
  amount: number;
}

interface ProductCardProps {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  vatRate?: number;
  priceIsFrom?: boolean;
  /**
   * From the list DTO: the card price is one of several quantity bands in
   * this currency. Lines added from the grid or saved to the wishlist carry it
   * so the cart sends a quantity change back through the product page instead
   * of editing the line at a tier that may no longer apply.
   *
   * Required, not optional, on purpose: a consumer that forgets to forward
   * `priceTiered` from the DTO would put a tiered product in the cart as a
   * flat-priced line and the stepper would then quietly edit it at the wrong
   * tier. The typechecker refusing the omission is the only place that
   * mistake is visible, so every grid passes `priceTiered={p.priceTiered === true}`.
   */
  priceTiered: boolean;
  /**
   * The published quantity breaks themselves, in the card currency. Fed by the
   * catalogue list DTO's `prices` rows — the same rows `priceTiered` is derived
   * from, which until now were being spent on a single grey word.
   *
   * Rendered ONLY when `isB2B`. A consumer seeing wholesale breaks is a pricing
   * leak, and the gate is here rather than at the call site because a caller
   * that forgets it leaks silently.
   */
  priceBands?: ProductCardPriceBand[];
  sku: string;
  sellerId: string;
  /**
   * The supplier's English trading name. It is also what the wishlist store
   * persists, so it stays canonical rather than following the visitor's locale:
   * a list saved in Arabic must not read back as Arabic in an English session.
   */
  sellerName?: string;
  /**
   * The supplier's Arabic trading name, straight off the list DTO's `seller`
   * projection. The EYEBROW follows the visitor's locale even though the stored
   * name does not — without this the Arabic build printed an English supplier
   * name at the top of all twenty-four cards, which is precisely the seam that
   * makes a bilingual product read as a translated one.
   */
  sellerNameAr?: string;
  inStock?: boolean;
  availabilityStatus?: "IN_STOCK" | "OUT_OF_STOCK" | "UNCONFIRMED";
  hasVariants?: boolean;
  moq?: number;
  locale?: "ar" | "en";
  isB2B?: boolean;
  category?: string;
  /** Card position in its grid. Only used to prioritise the first row's images. */
  index?: number;
}

/*
 * The `badge` ("HOT" | "NEW" | "SALE") and `originalPrice` props were removed
 * rather than left unused. No caller ever passed either, and both existed only
 * to render claims the catalog cannot support: "HOT" asserts a demand ranking
 * nothing computes, "NEW" was stamped on every product regardless of age, and a
 * struck-through `originalPrice` is discount theatre for a field the list DTO
 * does not return. Leaving the props in place left a working, typed doorway back
 * to all three. Do not re-add them.
 *
 * The `rating` and `reviewCount` props went the same way, and for a sharper
 * reason: they were real fields, but the catalogue holds no reviews, so every
 * card printed "No reviews yet" — twenty-four times per screen. That is
 * technically true and it turns the grid into a wall of absence: the loudest
 * signal on the page becomes "nobody has bought anything here." Truth does not
 * require printing the same null twenty-four times. The line is spent on the
 * SKU instead, which is a first-class comparison attribute for a procurement
 * buyer and was shown nowhere in the product. Reviews return to the tile the
 * day reviews exist.
 */

/**
 * Bands shown on a tile. Three is the ceiling the direction sets: more than that
 * needs a scrollbar, and a scrollbar inside a grid cell is not a price table.
 * The product page carries the full schedule.
 */
const LADDER_BANDS_ON_TILE = 3;

export function ProductCard({
  id, slug, nameEn, nameAr, imageUrl, price, currency, vatRate, priceIsFrom = false, priceTiered,
  priceBands, sku, sellerId, sellerName, sellerNameAr, inStock = true, availabilityStatus, moq = 1, hasVariants = false,
  locale, isB2B = false, category, index = 0,
}: ProductCardProps) {
  const tp = useTranslations("products");
  const tc = useTranslations("catalogue");
  const router = useRouter();
  const nextLocale = useLocale();
  const activeLocale = locale || (nextLocale as "en" | "ar");
  const addItem = useCartStore((s) => s.addItem);
  const { toggle, has } = useWishlist();
  // Persisted wishlist state would mismatch on hydration — gate on mount.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const wishlisted = mounted && has(id);
  const name = activeLocale === "ar" ? nameAr : nameEn;
  const pricePresentation = productCardPricePresentation(price, hasVariants);
  const productHref = storefrontProductHref(slug, { currency, b2b: isB2B });
  const availability = availabilityStatus ?? (inStock ? "IN_STOCK" : "OUT_OF_STOCK");
  const money = price != null && currency
    ? formatCurrency(price, currency as Currency, activeLocale)
    : null;
  // Whether the card price is the lowest of several quantity or variant bands
  // rather than THE price. It qualifies the figure; it is not part of it.
  const priceIsRange = pricePresentation === "FROM" || priceIsFrom;
  /*
   * What the eyebrow says: the category this is filed under, or failing that the
   * supplier who lists it — in the VISITOR'S language.
   *
   * `category` arrives already localised, because the server page holds the
   * locale and the DTO's own category projection. The supplier name is resolved
   * here instead, because `sellerName` is also what the wishlist persists and
   * that has to stay canonical English. Falling back to the English name when a
   * supplier has registered no Arabic trading name is deliberate: a blank
   * eyebrow tells an Arabic reader less than a name they can still recognise.
   */
  const filedUnder =
    category ??
    (activeLocale === "ar" && sellerNameAr?.trim() ? sellerNameAr : sellerName) ??
    undefined;

  /*
   * THE COMMIT, on the one control this card owns.
   *
   * The cart store is local and synchronous, so there is no server rejection to
   * roll back here — the line genuinely is in the cart the instant this runs,
   * and saying so is a statement of fact rather than an optimistic guess. The
   * label is swapped by <CommitLabel>'s clip-path wipe rather than a cross-fade,
   * so no frame of the button's label is ever half-transparent, and the state
   * returns to rest on its own. Nothing is gated, queued or delayed: a second
   * press adds a second line immediately and simply restarts the readout.
   */
  const [committed, setCommitted] = React.useState(false);
  const commitTimer = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => () => clearTimeout(commitTimer.current), []);

  /*
   * The quantity ladder, built from the bands the supplier actually published.
   *
   * The band label is wrapped in U+200E LEFT-TO-RIGHT MARK. A quantity range is
   * a numeric run with a neutral character at its edge ("50+", "1–49"), and a
   * neutral at the edge of a run inherits the paragraph direction — so in Arabic
   * "50+" renders as "+50". The mark is the standard fix and it is invisible in
   * both directions. This is the same class of bug as a one-sided mask: it
   * passes English review and ships wrong.
   */
  const ladderTiers = React.useMemo(() => {
    if (!isB2B || !currency || !priceBands || priceBands.length < 2) return [];
    return [...priceBands]
      .sort((a, b) => a.minQty - b.minQty)
      .map((band) => ({
        from: band.minQty,
        to: band.maxQty,
        band: band.maxQty == null ? `‎${band.minQty}+` : `‎${band.minQty}–${band.maxQty}`,
        price: formatCurrency(band.amount, currency as Currency, activeLocale),
      }));
  }, [isB2B, currency, priceBands, activeLocale]);

  function handleAddToCart() {
    const action = productCardPurchaseAction(hasVariants, inStock);
    if (action === "REQUEST_AVAILABILITY") {
      router.push(`/b2b/rfq/new?supplier=${encodeURIComponent(sellerId)}&product=${encodeURIComponent(id)}`);
      return;
    }
    if (action === "SELECT_VARIANT") {
      router.push(productHref);
      return;
    }
    if (price == null || !currency || vatRate == null) return;
    addItem({ productId: id, slug, channel: isB2B ? "B2B" : "B2C", nameEn, nameAr, imageUrl, sku, qty: moq, moq, unitPrice: price, vatRate, priceTiered, sellerId, currency });
    clearTimeout(commitTimer.current);
    setCommitted(true);
    commitTimer.current = setTimeout(() => setCommitted(false), 1800);
  }

  function handleWishlist() {
    if (hasVariants) {
      router.push(productHref);
      return;
    }
    if (price == null || !currency || vatRate == null) return;
    toggle({ id, slug, channel: isB2B ? "B2B" : "B2C", nameEn, nameAr, imageUrl, price, quantity: moq, moq, vatRate, currency, sku, sellerId, sellerName, inStock });
  }

  return (
    <Surface
      as="article"
      rung={2}
      interactive
      specular
      // `group` drives the frame's lift, `u-drawn-host` drives the brass rule
      // under the frame, and `data-clips-focus` is what keeps a keyboard user
      // visible: this card clips its own overflow for the specular gradient, so
      // an outward two-stop ring on any descendant would be sliced off at three
      // edges. The container redraws the identical ring inside its own box.
      data-clips-focus=""
      className="group u-drawn-host relative flex h-full flex-col overflow-hidden"
    >
      {/* The wishlist control stays OUTSIDE this anchor. It is a second action on
          the same card, and an interactive element nested inside a link is
          unreachable by keyboard and ambiguous to a screen reader. */}
      <Link href={productHref} className="block rounded-[inherit] outline-none" aria-label={tc("viewProduct", { name })}>
        {/*
         * ImageFrame, not aspect-square + object-cover.
         *
         * Cover on a square crops the valve off a fitting and the label off a
         * drum, and twenty-four supplier uploads treated that way read as a
         * scraped feed rather than a shelf. The frame contains rather than crops,
         * insets the product so it never touches its own edge, and puts every
         * photograph on the same tinted plate with the same cast floor under it
         * and the same overhead light on its top shoulder. That consistency
         * ACROSS the grid is the measured lever in premium commerce — not
         * effects — and it is entirely truthful, because it is framing.
         */}
        <ImageFrame
          sku={sku}
          state={availability === "OUT_OF_STOCK" ? "out" : availability === "UNCONFIRMED" ? "unconfirmed" : "available"}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              // The first two tiles are above the fold at every breakpoint this
              // grid ships at, and one of them is the LCP element. Nothing else
              // on the page is prioritised — priority on a whole row competes
              // with itself and stops meaning anything.
              priority={index < 2}
              // The breakpoints are the GRID's own — 2-up below sm, 3-up to xl,
              // 4-up above — not a guess. The previous string switched to 25vw
              // at 1024px while the grid was still 3-up until 1280px, so every
              // card between those two widths was served an image a third
              // narrower than the box it had to fill.
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            />
          ) : undefined}
        </ImageFrame>

        {/* The same brass hairline as active nav, a selected tab and the ladder's
            active band — one gesture in a different posture, drawn from the
            inline start on hover. It sits between the frame and the record. */}
        <div className="u-drawn" aria-hidden="true" />

        <div className="flex flex-col gap-1.5 p-4">
          {/* The record line: what it is filed under, and what it is called in a
              purchase order. Two facts, one row, at the lowest rank on the card.

              The eyebrow names the category or the seller, in the visitor's own
              language. When neither is known it is left out — printing the
              platform name there read as "sold by the platform", which is never
              true of a listing.

              It is metadata ink rather than --primary-ink: on a grid of 24 this
              is the lowest-rank line on the card, and 24 indigo eyebrows compete
              with the one thing that should carry colour, the price. */}
          <div className="flex items-baseline justify-between gap-2">
            {filedUnder ? (
              <Eyebrow className="min-w-0 truncate">{filedUnder}</Eyebrow>
            ) : (
              // Nothing to file it under and no supplier name in this language:
              // an empty <Eyebrow> is still a flex child and still eats the gap,
              // so the SKU simply moves to the start of the row.
              <span className="min-w-0" />
            )}
            <span className="u-mono u-meta shrink-0 text-ink-3">
              <span className="sr-only">{tc("skuLabel")} </span>
              {sku}
            </span>
          </div>

          {/* Exactly two lines of the ACTIVE script's own body leading, not a
              hardcoded 3rem. Latin body is 15/24 and Arabic is 16/26, so a fixed
              48px reserves two Latin lines and one-and-a-bit Arabic ones — and
              the price line stops agreeing across a row on the Arabic build
              only, which is precisely the class of defect an English reviewer
              never sees. */}
          <h3 className="u-body line-clamp-2 min-h-[calc(2*var(--lh-body))] font-medium text-ink-1">{name}</h3>

          {money ? (
            <PriceStack
              className="mt-0.5"
              amount={money}
              // "From" is a qualifier ON the figure, not part of it. Baked into
              // the formatted string it rendered at the figure's own rank, so a
              // tiered product's price line was one flat run of text — the
              // figure-to-label ratio collapsing at exactly the place a shopper
              // looks first.
              qualifier={priceIsRange ? tc("from") : undefined}
              // The stored unit price is VAT-EXCLUSIVE, so the card says so.
              // A bare figure a consumer reads as the amount they will pay, when
              // it is not, is the quiet kind of untruth this codebase spent a
              // programme removing. The figure itself is unchanged: which number
              // a shopper is shown is a money decision, not a design one.
              //
              // KNOWN DISAGREEMENT, RAISED RATHER THAN PAPERED OVER: the cart
              // line and the checkout summary are exclusive like this card, but
              // the product page now renders `unitPrice + vatPerUnit` with
              // "Incl. VAT" for B2C. So a consumer sees one figure here and a
              // larger one after the click. That is not a defect this surface
              // can fix on its own — aligning it either way changes what a
              // number means on three other pages — and it is in the handover.
              //
              // The rate goes in as a STRING on purpose: a number handed to the
              // formatter renders in the locale's own numeral system, so the
              // Arabic build would print ٥ beside a Western-digit price. One
              // numeral system, Western, everywhere — the same policy <Num>
              // states for money.
              vat={vatRate != null ? tc("vatExcl", { rate: String(vatRate) }) : undefined}
            />
          ) : (
            // Deliberately NOT a <Num>. "See options" is an instruction, and
            // setting an instruction at figure rank in tabular numerals told
            // the reader it was a price they had failed to parse.
            <p className="u-ui mt-0.5 font-medium text-ink-2">{tc("seeOptions")}</p>
          )}

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            {/* One stock language across three portals, and colour is never the
                only channel — the dot always carries its own label in words. */}
            <AvailabilityDot state={availability} label={tc(`stock.${availability}`)} />
            {moq > 1 && (
              // ONE message, not `{label}: {n} {noun}` assembled in JSX. A
              // sentence built out of two keys and a hardcoded colon cannot be
              // reordered by a translator, and Arabic needs the count to select
              // the noun (وحدتان / وحدات / وحدة) rather than to sit beside it.
              // The quantity goes in as a pre-formatted string so the digits
              // stay Western in both locales, exactly as the price does; `count`
              // is there only to choose the plural category.
              <span className="u-meta text-ink-3">
                {tc("minOrder", { count: moq, qty: String(moq) })}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* The channel mark sits on the card rather than inside the frame: the
          frame's only job is to hold a photograph on a lit plate, and anything
          floated inside it competes with the product for the same 4:5 box. */}
      {isB2B && (
        <StatusPill tone="accent" className="absolute start-2.5 top-2.5">
          {tc("b2bMark")}
        </StatusPill>
      )}

      <button
        type="button"
        onClick={handleWishlist}
        disabled={!hasVariants && (price == null || !currency || vatRate == null)}
        // Opaque, not backdrop-blurred. Blur is a floating-layer mark with a
        // budget of three surfaces per viewport; twenty-four blurred discs in a
        // grid is the number one way this system ships badly.
        //
        // It is quiet until it means something. A saved product carries the
        // danger fill; an unsaved one is a hairline plate at metadata ink, so
        // twenty-four of them do not out-shout twenty-four prices.
        className={`absolute end-2.5 top-2.5 z-10 grid h-9 w-9 place-items-center rounded-pill border transition-colors duration-hover ease-standard disabled:pointer-events-none disabled:opacity-40 ${
          wishlisted
            ? "border-danger bg-danger text-danger-foreground"
            : "border-hairline bg-surface-2 text-ink-3 hover:border-border hover:text-danger-ink"
        }`}
        aria-label={wishlisted ? tc("wishlistRemove", { name }) : tc("wishlistAdd", { name })}
        aria-pressed={wishlisted}
      >
        <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} aria-hidden="true" />
      </button>

      {/* THE LADDER SITS OUTSIDE THE ANCHOR. A <table> inside a link is valid
          HTML, but it puts a real tabular structure somewhere a screen-reader
          user reaches only by walking into a link — table navigation and link
          navigation are different modes and this belongs to the first.

          Gated on isB2B by the component rather than by the caller: a consumer
          seeing wholesale breaks is a pricing leak, and a caller that forgets
          the gate leaks silently. Renders nothing for a single-price product —
          an empty ladder is worse than no ladder. */}
      {ladderTiers.length > 1 && (
        <div className="mt-auto border-t border-hairline px-4 pt-2.5">
          <QuantityLadder
            tiers={ladderTiers}
            activeQty={moq}
            max={LADDER_BANDS_ON_TILE}
            caption={tc("ladder.caption")}
            headers={{ qty: tc("ladder.qty"), unitPrice: tc("ladder.unit") }}
          />
          {/* A tile shows at most three bands and never a scrollbar. Three of
              six rendered silently is a price schedule a procurement buyer would
              read as complete — and the band they actually want is the deepest
              one. The table is true; this line is what keeps it whole. */}
          {ladderTiers.length > LADDER_BANDS_ON_TILE && (
            <p className="u-meta mt-1.5 text-ink-3">
              {tc("ladder.more", {
                count: ladderTiers.length - LADDER_BANDS_ON_TILE,
                formatted: String(ladderTiers.length - LADDER_BANDS_ON_TILE),
              })}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto p-4 pt-3">
        {/* Secondary, not primary. The customer portal's budget is one indigo
            fill per view plus the page's single call to action, and a grid of
            twenty-four indigo buttons spends it twenty-four times over — after
            which nothing on the page reads as the commit action. The card's
            action is raised (law A: raised = actionable), which is what makes it
            legible as a button without the fill. */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="w-full"
          onClick={handleAddToCart}
          disabled={inStock && !hasVariants && (price == null || !currency || vatRate == null)}
        >
          {inStock ? <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" /> : <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />}
          {inStock && !hasVariants ? (
            <CommitLabel idle={tp("addToCart")} committed={tc("added")} done={committed} />
          ) : inStock ? (
            tp("selectOptions")
          ) : (
            tp("requestAvailability")
          )}
        </Button>
        {/* A label that changes is not announced. The fact that a line was
            recorded has to be said in words somewhere, or the confirmation is
            visual only. */}
        <p role="status" className="sr-only">
          {committed ? tc("addedAnnouncement", { name }) : ""}
        </p>
      </div>
    </Surface>
  );
}
