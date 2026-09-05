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
import { Stars } from "@/components/product/stars";
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
  /**
   * The review aggregate for this product, straight off the list DTO.
   *
   * ONE OBJECT, NOT TWO LOOSE NUMBERS. A `rating` without its `count` is a
   * score with no basis, and the typechecker is the only place that mistake is
   * ever visible.
   *
   * `null` is NOT YET REVIEWED, and it is emphatically not a zero: nothing has
   * been measured, so nothing is shown. The row is omitted entirely rather than
   * rendered as five empty stars — five empty stars IS a score, and it is the
   * one score this catalogue has never taken. `undefined` means the same thing
   * for a caller that has not been updated to forward the field yet, which is
   * why the prop is optional rather than required.
   */
  rating?: { average: number; count: number } | null;
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
 * `rating` and `reviewCount` went the same way at the time, for a sharper
 * reason: they were real fields, but the catalogue held no reviews, so every
 * card printed "No reviews yet" — twenty-four times per screen. That is
 * technically true and it turns the grid into a wall of absence: the loudest
 * signal on the page becomes "nobody has bought anything here."
 *
 * "Reviews return to the tile the day reviews exist" was the condition, and it
 * is now met: the list DTO carries a `rating` AGGREGATE. So the star row is
 * back — as one object rather than two loose numbers, and still never as an
 * absence. `rating: null` renders nothing at all, so a grid of unreviewed
 * listings looks exactly as it did and the SKU keeps its line; only the tiles
 * with a real basis gain a row.
 *
 * `badge` and `originalPrice` do NOT come back with it, and the reference
 * design's red "SALE" mark and struck-through figure are the reason to say so
 * again: there is still no compare-at price anywhere in the schema, so both
 * would be inventing the discount they announce. The reference's top-start
 * badge slot is filled by the B2B channel mark instead, which is a fact the
 * card is already given.
 */

/**
 * Bands shown on a tile. Three is the ceiling the direction sets: more than that
 * needs a scrollbar, and a scrollbar inside a grid cell is not a price table.
 * The product page carries the full schedule.
 */
const LADDER_BANDS_ON_TILE = 3;

export function ProductCard({
  id, slug, nameEn, nameAr, imageUrl, price, currency, vatRate, priceIsFrom = false, priceTiered,
  priceBands, sku, sellerId, sellerName, sellerNameAr, rating, inStock = true, availabilityStatus, moq = 1, hasVariants = false,
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
   * THE RATING FIGURE, and why it is a string.
   *
   * One decimal, rounded exactly as the product page rounds it, so the tile and
   * the page it links to never disagree by a tenth. It is built here as a
   * STRING and handed to the message tree as one, for the same reason the VAT
   * rate and the MOQ are: a number given to an ICU formatter renders in the
   * locale's own numeral system, and the Arabic build would print ٤٫٢ beside a
   * Western-digit price. One numeral system, Western, everywhere.
   *
   * `count` goes in as a number ALONGSIDE its formatted string, because ICU
   * needs the number to pick the Arabic plural category and the string to print
   * the digits.
   */
  const ratingValue = rating ? String(Math.round(rating.average * 10) / 10) : null;

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
         *
         * IT STAYS 4:5 EVEN THOUGH THE REFERENCE IS SQUARE. `--img-ratio-card`
         * is a portal token, not a card decision: customer is 4/5, seller and
         * admin are 1/1, and the same <ImageFrame> renders the cart line, the
         * wishlist tile, the RFQ line, the order line and the PDP related rail.
         * Overriding it here would make the product grid the one surface in the
         * storefront whose frames do not agree with the rest — the exact
         * failure the shared frame exists to prevent, where one tile out of
         * nine announces that the system is not actually a system. Everything
         * else the reference does to its image — the light plate, the contained
         * product, the generous inset, the identical treatment across the grid
         * — this frame already does.
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

        {/* THE REFERENCE'S DENSITY, CARRYING FOUR MORE FACTS THAN THE REFERENCE
            TILE HAS. p-3.5 and gap-1 rather than p-4 and gap-1.5: this tile has
            to read at 5-up as well as 2-up, and the reference earns its
            tightness by carrying a name, a rating and a price and nothing else.
            This one additionally carries the supplier, the SKU, the VAT basis,
            the MOQ, the channel and the availability — so the spacing has to
            work harder rather than the tile growing taller.

            THE INFORMATION ORDER IS THE REFERENCE'S: frame, rating, name,
            price, then the one action. The trade facts are threaded into that
            order rather than appended after it — the record line rides above
            the rating where the reference has nothing, and availability rides
            the end of the price row where the reference puts its stock mark. */}
        <div className="flex flex-col gap-1 p-3.5">
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

          {/*
            THE RATING ROW — present only when there is something to rate.
            `rating: null` is NOT YET REVIEWED, so this renders nothing at all:
            no row, no reserved gap, and above all not five empty stars, which
            would state a score of zero the catalogue never measured.

            <Stars> is the product's ONE rating mark, shared with the product
            page, the review panel and the supplier card. Reusing it is not
            tidiness, it is the two properties this row would otherwise have to
            re-derive:

              IT IS RTL-SAFE BY CONSTRUCTION. It draws five whole glyphs and
              fills a whole number of them. There is no percentage-width mask
              and therefore no physical direction to get wrong — the failure
              mode the system names explicitly, where a `width: 84%` overlay
              fills from the left in a script that reads from the right and
              every Arabic rating silently inverts. A mask here would have
              needed `* var(--dir)`; having no mask is better than having a
              correct one.

              THE GLYPHS ARE INK, NOT BRASS OR AMBER. The reference's stars are
              gold; brass in this system has exactly three permitted uses and a
              rating is not one of them, so a gold star row would make "4.6
              stars" and "GOLD supplier" read as the same class of claim.

            AND IT IS NEVER CARRIED BY THE GLYPHS. A star row is colour plus
            shape and nothing else, so the whole row is hidden from assistive
            technology and the fact is stated once, in words, in the sr-only
            line: the score, the scale it is out of, and how many reviews it
            rests on.

            `count > 0` is belt AND braces. The contract says `null` is the
            not-yet-reviewed signal, but an aggregate that arrives as
            `{ average: 0, count: 0 }` — which is what a naive SQL AVG/COUNT
            over an empty set tends to produce — means exactly the same thing,
            and it is the one shape that would print "Rated 0 out of 5" across
            a whole grid. A score with no basis is not shown. */}
          {rating && rating.count > 0 && ratingValue && (
            <p className="flex items-center gap-1.5">
              <Stars value={rating.average} className="h-3.5 w-3.5" />
              <span className="fig u-meta font-medium text-ink-1" aria-hidden="true">
                {ratingValue}
              </span>
              {/* U+200E before a parenthesised numeral run, the same fix the
                  ladder's band labels use. Brackets are neutral characters and
                  a neutral at the edge of a run inherits the paragraph
                  direction, so an unmarked "(750)" is one Arabic paragraph away
                  from rendering as ")750(". Invisible in both directions. */}
              <span className="u-meta truncate text-ink-3" aria-hidden="true">
                {"\u200E"}
                {tc("rating.count", { formatted: String(rating.count) })}
              </span>
              <span className="sr-only">
                {tc("rating.aria", { value: ratingValue, count: rating.count })}
              </span>
            </p>
          )}

          {/* Exactly two lines of the ACTIVE script's own body leading, not a
              hardcoded 3rem. Latin body is 15/24 and Arabic is 16/26, so a fixed
              48px reserves two Latin lines and one-and-a-bit Arabic ones — and
              the price line stops agreeing across a row on the Arabic build
              only, which is precisely the class of defect an English reviewer
              never sees. */}
          <h3 className="u-body line-clamp-2 min-h-[calc(2*var(--lh-body))] font-medium text-ink-1">{name}</h3>

          {/* THE PRICE ROW. The reference sets its stock mark on the same line
              as the figure, and that is right: "what it costs" and "can I have
              it" are one question a buyer asks once. flex-wrap rather than a
              fixed two-column split, because "Availability unconfirmed" beside
              a four-figure price does not fit a 5-up tile at any type size —
              when it does not fit it drops to its own line instead of
              compressing the figure, which is the one thing on the card that
              must never be squeezed. */}
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
            {money ? (
              <PriceStack
                className="min-w-0"
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
            ) : hasVariants ? (
              // Deliberately NOT a <Num>. "See options" is an instruction, and
              // setting an instruction at figure rank in tabular numerals told
              // the reader it was a price they had failed to parse.
              <p className="u-ui font-medium text-ink-2">{tc("seeOptions")}</p>
            ) : (
              /*
                No price in this channel, and no variants to choose between — so
                there is nothing for a consumer to buy at any figure. Every one of
                the 385 live listings is B2B-only, and "See options" sent those
                shoppers to a page with no options and no price, which reads as a
                storefront that is broken rather than one that quotes.
                Naming the actual route is both the honest answer and the
                commercially correct one: this catalogue is quoted, not carted.
              */
              <p className="u-ui font-medium text-primary-ink">{tc("quoteOnRequest")}</p>
            )}

            {/* Availability and MOQ travel together at the end of the price
                row as ONE block, so they wrap as one rather than splitting
                across two lines with the figure stranded between them.
                items-end is the inline END in both scripts — no `text-right`
                anywhere, which is the class of thing that ships English-correct
                and Arabic-wrong. */}
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              {/* One stock language across three portals, and colour is never
                  the only channel — the dot always carries its own label in
                  words. */}
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
        </div>
      </Link>

      {/* THE BADGE SLOT, FILLED WITH SOMETHING TRUE.

          The reference puts a red "SALE" mark and a yellow "-30%" chip in the
          frame's two top corners. Neither can be built: there is no compare-at
          price in the schema, so a discount mark would be announcing a saving
          against a figure that does not exist. The slot is not left empty
          either — the channel mark takes it, which is a fact the card is
          already handed and one a buyer sorts on.

          It sits on the card rather than inside the frame: the frame's only job
          is to hold a photograph on a lit plate, and anything floated inside it
          competes with the product for the same 4:5 box. */}
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
        <div className="mt-auto border-t border-hairline px-3.5 pt-2.5">
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

      <div className="mt-auto p-3.5 pt-2.5">
        {/* ACCENT, WHICH IS WHERE THE KEY-EDGE LIVES ON THIS TILE.

            The reference gives every tile a filled "Add to Cart", and the
            filled variants are the ones that carry `.u-key` — a solid
            `--key-edge` band under the face that says how THICK the control is,
            with the blurred elevation underneath saying how far it floats. On
            press the face travels straight DOWN by the height of its own edge
            and the edge disappears. That is the whole 3D budget this tile
            spends, and it is spent on the one thing a finger actually touches.

            Accent rather than primary, which is the correction to the note this
            replaces. That note was right that a grid must not spend the commit
            fill twenty-four times — after which nothing on the page reads as
            THE call to action — and wrong only in calling it indigo; --primary
            has been a deep green for a while. Accent is the documented "trade /
            verified / settled" fill, and adding a trade line or opening an RFQ
            is exactly a trade action. So the tile gets the reference's filled
            affordance and its real thickness, and the page's single commit fill
            stays unspent.

            Depth here is Z-POSITION and nothing else. No tilt, no perspective,
            no pointer rotation on the card: past a few degrees horizontal type
            picks up colour fringing, and a rotated cast shadow stops agreeing
            with the single overhead light every other surface is lit by — which
            is the invariant that makes this system free in Arabic. */}
        <Button
          type="button"
          variant="accent"
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
