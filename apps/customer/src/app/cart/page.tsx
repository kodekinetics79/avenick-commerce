"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ShoppingBag, ArrowRight, Heart, Minus, Plus, Undo2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Button, CommitRow, EmptyState, FieldWell, PageHeader, PriceStack, Skeleton, SkeletonList,
  StatusPill, Surface,
} from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import { cartLineNeedsRepricing, cartQuantityBounds, cartQuantityChangeHref, useCartStore, type CartItem } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { MainLayout } from "@/components/layout/main-layout";
import { cartDestination, summarizeCartCommercial } from "@/lib/cart-commercial";
import { copyFrom, LineFrame, MoneyRow, Receipt, type Copy } from "./_money-path";

const STEP_BUTTON =
  "u-focus grid h-control-sm w-control-sm place-items-center rounded-nested text-ink-2 " +
  "transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 " +
  "disabled:opacity-40 disabled:hover:bg-transparent aria-disabled:opacity-40 aria-disabled:pointer-events-none";

const LINE_ACTION =
  "u-focus inline-flex items-center gap-1.5 rounded-nested px-2 py-1 text-meta text-ink-3 " +
  "transition-colors duration-press ease-standard";

/** The line's own name, in the reader's language.
 *
 *  Round one printed the English name as the heading and the Arabic name
 *  underneath it as a caption, on every row, in both builds. That is the
 *  textbook translated-looking tell: it says the Arabic build is a setting on an
 *  English page rather than a design of its own. One name, in the language the
 *  page is set in, falling back to the other only when the catalogue never
 *  recorded one. */
const lineName = (item: Pick<CartItem, "nameEn" | "nameAr">, locale: string) =>
  (locale === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr);

/**
 * Why THIS line is holding the cart up, said on the line itself.
 *
 * summarizeCartCommercial refuses a total when any line is missing a commercial
 * fact, and cartDestination refuses a destination when the lines disagree about
 * the sales channel. Both refusals used to be reported only as one sentence
 * beside a disabled button, which told a buyer that something was wrong but
 * never which of their items was the something. Nothing here is inferred: every
 * branch names a fact the stored line is actually missing, in the same order the
 * two summarisers test them.
 *
 * It returns a message KEY rather than a sentence: the notice is the most
 * consequential copy on the page — it is the reason a buyer cannot check out —
 * and it was the one string here that could never be read in Arabic.
 */
type LineNotice = {
  tone: "danger" | "warning";
  key: string;
  fallback: string;
  values?: Record<string, string | number>;
};

function lineNotice(
  item: CartItem,
  mixedCurrency: boolean,
  mixedChannel: boolean,
): LineNotice | null {
  if (!Number.isFinite(item.unitPrice)) return { tone: "danger", key: "cart.notice.noPrice", fallback: "Unit price not recorded" };
  if (!Number.isInteger(item.qty) || item.qty <= 0) return { tone: "danger", key: "cart.notice.noQty", fallback: "Quantity not recorded" };
  if (item.vatRate == null || !Number.isFinite(item.vatRate) || item.vatRate < 0) {
    return { tone: "danger", key: "cart.notice.noVat", fallback: "VAT rate not recorded" };
  }
  // summarizeCartCommercial filters falsy currencies out before it counts them,
  // so a line with no currency at all is folded into whatever the other lines
  // are priced in and never blocks the total. That silence is the reason it has
  // to be said on the line: warning rather than danger, because the cart is
  // still checkoutable and a danger pill beside an enabled button is a lie
  // about which state the buyer is in.
  if (!item.currency) return { tone: "warning", key: "cart.notice.noCurrency", fallback: "Currency not recorded" };
  if (mixedCurrency) return { tone: "warning", key: "cart.notice.pricedIn", fallback: `Priced in ${item.currency}`, values: { currency: item.currency } };
  if (!item.channel) return { tone: "warning", key: "cart.notice.noChannel", fallback: "Sales channel not recorded" };
  if (mixedChannel) return { tone: "warning", key: "cart.notice.channelLine", fallback: `${item.channel} line`, values: { channel: item.channel } };
  return null;
}

/**
 * A line's own money, or an em dash.
 *
 * formatCurrency puts the amount through Intl.NumberFormat, which renders a
 * non-finite number as the literal string "NaN" — so a line whose unit price
 * was never recorded printed "AED NaN" at figure rank, directly beside the pill
 * saying the price is missing. A fractional quantity is the same class of
 * problem: the arithmetic succeeds and produces a total the server will never
 * charge. Neither is shown. The pill is the statement; the figure withholds
 * itself rather than inventing one.
 *
 * The locale is passed now. The storefront grid has always formatted with it,
 * so the same product printed "AED 120.00" on the card and on the cart line in
 * an Arabic session while every other string around it was Arabic. Two
 * formatters for one price is exactly the seam that makes a bilingual product
 * read as a translated one.
 */
function lineMoney(item: CartItem, amount: number, locale: "ar" | "en"): string {
  const priced = Number.isFinite(item.unitPrice) && Number.isInteger(item.qty) && item.qty > 0;
  if (!priced || !Number.isFinite(amount)) return "—";
  return formatCurrency(amount, item.currency as never, locale);
}

/**
 * Quantity control for one cart line.
 *
 * A line with a flat unit price is edited in place and the row total follows.
 * A line whose unit price is quantity-tiered (every B2B line, and a B2C line
 * the product page flagged as tiered) was priced on the product page for the
 * quantity it holds: editing the quantity here while keeping that tier's price
 * would show a total the server will never charge, so its "−"/"+" are links to
 * the product page at the new quantity, where the tier is re-resolved before
 * the line is replaced.
 *
 * MOTION: none, deliberately. A quantity stepper is a hundred-presses-a-day
 * control, and the frequency rule is explicit — anything at that frequency gets
 * zero animation. The figure between the two buttons is the number the buyer
 * pays against; it is swapped instantly and never transitions.
 */
function QuantityStepper({ item, onSet, c, name }: { item: CartItem; onSet: (qty: number) => void; c: Copy; name: string }) {
  const { min, max } = cartQuantityBounds(item);
  const atMin = item.qty <= min;
  const atMax = item.qty >= max;
  const tiered = cartLineNeedsRepricing(item);
  // One value per direction, used by the href, the accessible name and the
  // tooltip alike. They used to be derived separately: at the minimum the href
  // fell back to the current quantity while the label still said "Reprice at
  // ${qty - 1} units", so a line sitting at an MOQ of 1 announced "Reprice at 0
  // units" for a link that would have requested 1. A control must never name a
  // quantity it is not going to ask for.
  const downTo = atMin ? item.qty : item.qty - 1;
  const upTo = atMax ? item.qty : item.qty + 1;
  const repriceAt = (qty: number) => c("cart.repriceAt", `Reprice at ${qty} units`, { qty });

  if (tiered && !item.slug) {
    // A line persisted before slugs were stored cannot be repriced from here.
    return (
      <span className="u-ui font-medium text-ink-1">
        {c("cart.quantity", "Quantity")} <span className="tnum">{item.qty}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Recessed on purpose: law A reads "recessed = context or input", and a
          quantity control is the canonical input. Pressed into the card, it also
          stops competing with the raised checkout button for attention. */}
      <FieldWell className="inline-flex items-center rounded-nested p-0" role="group" aria-label={`${c("cart.quantity", "Quantity")} — ${name}`}>
        {tiered ? (
          <Link
            // Disabled links keep a harmless target (the current quantity) so an
            // assistive-tech activation can never request a quantity below the MOQ.
            href={cartQuantityChangeHref(item, downTo)}
            aria-disabled={atMin}
            tabIndex={atMin ? -1 : undefined}
            aria-label={repriceAt(downTo)}
            title={repriceAt(downTo)}
            className={STEP_BUTTON}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" disabled={atMin} aria-label={c("cart.decrease", "Decrease quantity")} onClick={() => onSet(item.qty - 1)} className={STEP_BUTTON}>
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {/* The figure itself never animates — law D, and doubly so on a number
            that decides what the buyer pays. */}
        <span className="tnum min-w-[2.5rem] px-2 text-center text-ui font-medium text-ink-1" aria-live="polite">{item.qty}</span>
        {tiered ? (
          <Link
            href={cartQuantityChangeHref(item, upTo)}
            aria-disabled={atMax}
            tabIndex={atMax ? -1 : undefined}
            aria-label={repriceAt(upTo)}
            title={repriceAt(upTo)}
            className={STEP_BUTTON}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" disabled={atMax} aria-label={c("cart.increase", "Increase quantity")} onClick={() => onSet(item.qty + 1)} className={STEP_BUTTON}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </FieldWell>
      {tiered && <StatusPill tone="accent">{c("cart.tiered", "Quantity-tiered · repriced on the product page")}</StatusPill>}
      {!tiered && min > 1 && atMin && (
        <span className="u-meta text-ink-3">{c("cart.minimum", `Minimum ${min}`, { min })}</span>
      )}
    </div>
  );
}

/**
 * ONE CART LINE, and the gesture that makes removing something feel physical.
 *
 * Pressing "Remove" or "Save for later" does not make the row vanish. The row
 * becomes a record of the decision first: a 3px rule appears at its inline
 * start in the tone of what happened — danger for a removal, success for a save
 * — a soft wash of that tone wipes across the row from the same edge, and then
 * the row leaves on opacity and a short inline slide. `.u-commit` is the exact
 * gesture the admin approvals queue and the seller RFQ inbox use for the same
 * event, which is what makes the storefront and the console feel like one
 * product rather than two.
 *
 * THE UNMOUNT IS TIMER-DRIVEN, NOT transitionend-DRIVEN, and that is not a
 * shortcut. The reduced-motion contract replaces `.u-commit`'s transition list
 * with colour only — deliberately, so a motion-sensitive user still perceives
 * the state change — which means no `transitionend` for `opacity` ever fires
 * there. A transitionend-only unmount would leave the row on screen forever for
 * roughly one user in twenty, and it would look like a broken delete.
 *
 * Nothing here gates the action: the store write happens on a timer the user
 * cannot be blocked by, there is no pointer-events window, and a second press
 * on another row starts its own readout immediately.
 */
const COMMIT_HOLD_MS = 180;
const COMMIT_EXIT_MS = 200;

function CartLine({
  item, notice, locale, c, onSet, onRemove, onSave,
}: {
  item: CartItem;
  notice: LineNotice | null;
  locale: "ar" | "en";
  c: Copy;
  onSet: (qty: number) => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  const [phase, setPhase] = React.useState<"idle" | "committed" | "exiting">("idle");
  const [tone, setTone] = React.useState<"danger" | "success">("danger");
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function leave(kind: "remove" | "save") {
    if (phase !== "idle") return;
    setTone(kind === "remove" ? "danger" : "success");
    setPhase("committed");
    timers.current.push(setTimeout(() => setPhase("exiting"), COMMIT_HOLD_MS));
    timers.current.push(setTimeout(kind === "remove" ? onRemove : onSave, COMMIT_HOLD_MS + COMMIT_EXIT_MS));
  }

  const name = lineName(item, locale);
  const href = cartQuantityChangeHref(item);
  const unitEach = c("cart.eachUnit", `${lineMoney(item, item.unitPrice, locale)} each`, {
    amount: lineMoney(item, item.unitPrice, locale),
  });

  return (
    // u-frame-host: hovering anywhere on the row lifts the product off its cast
    // floor inside the frame while the floor stays put. One composited
    // transform, and the reason a list of supplier photographs reads as a shelf.
    <CommitRow
      as="li"
      state={phase}
      tone={tone}
      className="u-frame-host flex gap-4 p-4 sm:gap-5 sm:p-5"
    >
      <Link
        href={href}
        // Decorative here: the product name below is the same link, and exposing
        // it twice doubles the tab stops and makes a screen reader read every
        // line's name twice.
        aria-hidden="true"
        tabIndex={-1}
        className="block shrink-0"
      >
        <LineFrame width="w-[72px] sm:w-[88px]" sku={item.sku}>
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt="" fill sizes="88px" />
          ) : undefined}
        </LineFrame>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="u-body font-medium">
              <Link href={href} className="u-focus line-clamp-2 rounded-nested text-ink-1 transition-colors duration-press ease-standard hover:text-primary-ink">
                {name}
              </Link>
            </h3>
            {/* The SKU is a first-class comparison attribute for a procurement
                audience and it is the identifier a buyer quotes on the phone.
                Mono is what mono is for. */}
            <p className="u-mono u-meta mt-1 text-ink-3">{item.sku}</p>
          </div>

          {/* The line total is the figure on this row — fig-card rank, 22px,
              because a price is the first thing an eye lands on and 20px is a
              dashboard stat size. Money is ink, never indigo: the primary fill
              is reserved for the one action that commits the order. */}
          <PriceStack
            className="shrink-0 items-end text-end"
            amount={lineMoney(item, item.unitPrice * item.qty, locale)}
            // One meta run under the figure rather than two stacked ones: the
            // unit price and the VAT rate are read together — "thirty dirhams
            // each, five per cent" — and splitting them onto two lines put a
            // third rank on a row that only has room for two.
            //
            // "Excl. VAT", not "VAT 5%". summarizeCartCommercial builds the
            // subtotal from unitPrice × qty and adds VAT on top, so this figure
            // is VAT-EXCLUSIVE — and a run that states only the rate leaves a
            // buyer reading the largest number on the row as the amount they
            // will be charged for it, which it is not. The <PriceStack> vat slot
            // exists to say which of the two a figure is; stating the rate
            // without stating that is the half of the sentence that matters
            // least.
            vat={
              item.vatRate != null
                ? `${unitEach} · ${c("cart.exclVatRate", `Excl. VAT ${item.vatRate}%`, { rate: item.vatRate })}`
                : unitEach
            }
          />
        </div>

        {notice && (
          <StatusPill tone={notice.tone} dot className="mt-2.5">
            {c(notice.key, notice.fallback, notice.values)}
          </StatusPill>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <QuantityStepper item={item} onSet={onSet} c={c} name={name} />
          <div className="flex items-center gap-1">
            <button
              type="button"
              // Save-for-later is disabled rather than silently inert on a line
              // with no slug: the wishlist is keyed by slug, so the old handler
              // returned without doing anything and the buyer pressed a button
              // that did nothing at all.
              disabled={!item.slug}
              onClick={() => leave("save")}
              className={`${LINE_ACTION} hover:bg-primary-soft hover:text-primary-ink disabled:opacity-40 disabled:hover:bg-transparent`}
            >
              <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {c("cart.saveForLater", "Save for later")}
            </button>
            <button
              type="button"
              aria-label={c("cart.removeNamed", `Remove ${name} from the cart`, { name })}
              onClick={() => leave("remove")}
              className={`${LINE_ACTION} hover:bg-danger-soft hover:text-danger-ink`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {c("cart.remove", "Remove")}
            </button>
          </div>
        </div>
      </div>
    </CommitRow>
  );
}

export default function CartPage() {
  const { items, removeItem, setQty, addItem } = useCartStore();
  const { toggle, has: wishlistHas } = useWishlist();
  const t = useTranslations();
  const c = copyFrom(t);
  const locale = useLocale() === "ar" ? "ar" : "en";
  const summary = summarizeCartCommercial(items);
  const destination = cartDestination(items);
  const subtotal = summary.valid ? summary.subtotal : 0;
  const orderTotal = summary.valid ? summary.total : 0;
  // Computed once for the whole list: a line is only "the odd currency" or "the
  // odd channel" relative to the rest of the cart, so the test cannot live
  // inside the row.
  // .filter(Boolean) matches summarizeCartCommercial, which drops falsy
  // currencies before it counts them. Without it, one line missing a currency
  // made the set size 2 and every OTHER line was labelled "Priced in AED" — a
  // mixed-currency warning on a cart the summariser had just priced happily.
  const mixedCurrency = new Set(items.map((i) => i.currency).filter(Boolean)).size > 1;
  const mixedChannel = new Set(items.map((i) => i.channel)).size > 1;
  const money = (value: number) => (summary.valid ? formatCurrency(value, summary.currency as never, locale) : "—");

  /**
   * THE ROLLBACK IS BUILT WITH THE GESTURE, NOT AFTER IT.
   *
   * A cart line is the one object on this path a buyer can destroy in a single
   * press, on a control sitting three pixels from the one that saves it for
   * later. The removed line is held here — the whole line, exactly as stored —
   * so putting it back is one press and not a trip to the catalogue to find it
   * again. Nothing is faked: undo re-adds the same recorded price, quantity,
   * VAT rate and currency the line carried, and the server still re-prices all
   * of it at order time.
   *
   * It is not a floating toast. It is a line in the record, at the top of the
   * list, in the reading flow — which is also why it does not time out and
   * disappear while the buyer is looking away.
   */
  const [lastAction, setLastAction] = React.useState<{ kind: "removed" | "saved"; item: CartItem; name: string } | null>(null);

  // See the loading state below for why this gate exists.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  function removeLine(item: CartItem) {
    removeItem(item.id);
    setLastAction({ kind: "removed", item, name: lineName(item, locale) });
  }

  function saveForLater(item: CartItem) {
    if (!item.slug) return;
    // `toggle` is the store's only add path and it REMOVES a product that is
    // already saved. Without this guard, saving a line for a product already in
    // the wishlist deleted it from the wishlist and from the cart in one press,
    // while the strip below reported "Saved … to your wishlist" — a statement
    // the store had just made false. Already saved is already saved: the line
    // still leaves the cart, and nothing is written twice.
    if (wishlistHas(item.productId, item.variantId)) {
      removeItem(item.id);
      setLastAction({ kind: "saved", item, name: lineName(item, locale) });
      return;
    }
    // `inStock` records only that the line was addable when it was saved — a
    // cart line carries no stock fact at all — so the wishlist shows it as
    // UNCONFIRMED rather than as an affirmative availability mark.
    toggle({ id: item.productId, slug: item.slug, channel: item.channel, variantId: item.variantId, nameEn: item.nameEn, nameAr: item.nameAr, imageUrl: item.imageUrl, price: item.unitPrice, quantity: item.qty, moq: item.moq, vatRate: item.vatRate, priceTiered: item.priceTiered, currency: item.currency, sku: item.sku, sellerId: item.sellerId, inStock: true });
    removeItem(item.id);
    setLastAction({ kind: "saved", item, name: lineName(item, locale) });
  }

  function undoRemoval() {
    if (!lastAction) return;
    addItem(lastAction.item);
    setLastAction(null);
  }

  const pageTitle = c("cart.title", "Your cart");
  const pageDateline = c(
    "cart.dateline",
    "Held in this browser · each price is the one recorded when the line was added",
  );

  /**
   * THE LOADING STATE, and it exists because of a defect the redesign made
   * visible.
   *
   * The cart lives in localStorage, which does not exist on the server. The
   * first render on BOTH sides is therefore an empty cart, and the persisted
   * lines only arrive after hydration. Round one's empty state was a small
   * centred block and the flash went unnoticed; the certificate is a 420px
   * plate, so a buyer with a full cart would be told "Your cart is empty" — in
   * large serif — for a frame before their lines appeared. That is the most
   * alarming sentence this page could produce, and it would not even be true.
   *
   * The skeleton occupies the same boxes the real panels do, so nothing moves
   * when the lines land. A page that assembles itself in front of you cannot
   * look expensive no matter what it assembles into.
   */
  if (!hydrated) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-6xl px-4 py-block">
          <PageHeader eyebrow={c("cart.eyebrow", "Cart")} title={pageTitle} dateline={pageDateline} />
          <div className="grid grid-cols-1 gap-block lg:grid-cols-[minmax(0,1fr)_minmax(320px,404px)]">
            <SkeletonList rows={3} />
            <Surface rung={2} className="p-5 sm:p-6" aria-hidden="true">
              <Skeleton className="h-0.5 w-14" />
              <Skeleton className="mt-4 h-3 w-28" />
              <Skeleton className="mt-4 h-16 w-full rounded-nested" />
              <Skeleton className="mt-6 h-10 w-44" />
              <Skeleton className="mt-6 h-control-lg w-full rounded-nested" />
            </Surface>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (items.length === 0) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-4xl px-4 py-section">
          {/*
            THE CERTIFICATE. Not a centred grey apology in a card — a composed,
            left-aligned plate with the brass rule across its top edge, faint
            ledger ruling behind it and the bag glyph cropped off the outer
            corner at 5% ink, which is what makes it read as composition rather
            than as a shrug. Its lead sentence is set in the provenance voice:
            Source Serif italic in English, upright Noto Naskh in Arabic.

            The Arabic mirror line that used to sit above the button is gone. It
            existed because the page had no message tree; now that every string
            comes from one, the Arabic build is a design rather than a caption
            printed under an English one.
          */}
          <EmptyState
            variant="certificate"
            eyebrow={c("cart.empty.eyebrow", "Nothing in the cart")}
            headline={c("cart.empty.headline", "Your cart is empty.")}
            body={c("cart.empty.body", "Anything you add from the marketplace is held here, in this browser, until you check out.")}
            glyph={<ShoppingBag aria-hidden="true" />}
            action={
              <Button asChild variant="primary" size="lg">
                <Link href="/products">
                  {c("cart.browse", "Browse products")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </div>
      </MainLayout>
    );
  }

  const lineCount = c("cart.lineCount", `${items.length} line${items.length !== 1 ? "s" : ""}`, { count: items.length });
  const isPurchaseOrder = destination.valid && destination.href.startsWith("/b2b");
  const commitLabel = !destination.valid
    ? c("cart.unavailable", "Checkout unavailable")
    : isPurchaseOrder
      ? c("cart.createPurchaseOrder", "Create purchase order")
      : c("cart.checkout", "Proceed to checkout");

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-block">
        <PageHeader eyebrow={c("cart.eyebrow", "Cart")} title={pageTitle} dateline={pageDateline} />

        {lastAction && (
          // .u-pop is the system's @starting-style entry: it scales from 0.965
          // and travels 8px from the inline start, in 180ms, and it is inert
          // under reduced motion. role="status" so the removal is announced
          // rather than only seen.
          <Surface
            rung={1}
            role="status"
            className="u-pop mb-stack flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <p className="u-ui flex min-w-0 items-center gap-2 text-ink-2">
              <Undo2 className="h-4 w-4 shrink-0 text-ink-3 rtl:-scale-x-100" aria-hidden="true" />
              <span className="truncate">
                {lastAction.kind === "removed"
                  ? c("cart.removedLine", `Removed ${lastAction.name}`, { name: lastAction.name })
                  : c("cart.savedLine", `Saved ${lastAction.name} to your wishlist`, { name: lastAction.name })}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {lastAction.kind === "removed" ? (
                <Button size="sm" variant="secondary" onClick={undoRemoval}>
                  {c("cart.undo", "Put it back")}
                </Button>
              ) : (
                <Button asChild size="sm" variant="secondary">
                  <Link href="/wishlist">{c("cart.viewWishlist", "View wishlist")}</Link>
                </Button>
              )}
              <button
                type="button"
                aria-label={c("cart.dismiss", "Dismiss")}
                onClick={() => setLastAction(null)}
                className="u-focus grid h-control-sm w-control-sm place-items-center rounded-nested text-ink-3 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </Surface>
        )}

        {/* Asymmetric on purpose. Round one used a plain thirds grid, which gave
            the summary a third of the page and made the total compete with the
            list for width. The lines take whatever is left; the receipt gets a
            fixed, generous column so the total can sit at hero figure rank
            without ever wrapping. */}
        <div className="grid grid-cols-1 gap-block lg:grid-cols-[minmax(0,1fr)_minmax(320px,404px)]">
          {/*
            One panel divided by hairlines rather than N floating cards. A cart is
            read as a running list of what you are about to buy, and a receipt
            reads as one object; four bordered boxes read as four unrelated ones.
          */}
          <Surface rung={2} as="section" aria-label={c("cart.linesLabel", "Cart lines")} className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-border-strong px-4 py-3.5 sm:px-5">
              <h2 className="u-h3 text-ink-1">{c("cart.linesTitle", "Lines")}</h2>
              <p className="u-meta text-ink-3">{lineCount}</p>
            </div>
            <ul className="divide-y divide-hairline">
              {items.map((item) => (
                <CartLine
                  key={item.id}
                  item={item}
                  notice={lineNotice(item, mixedCurrency, mixedChannel)}
                  locale={locale}
                  c={c}
                  onSet={(qty) => setQty(item.id, qty)}
                  onRemove={() => removeLine(item)}
                  onSave={() => saveForLater(item)}
                />
              ))}
            </ul>
          </Surface>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Receipt
              eyebrow={c("cart.orderSummary", "Order summary")}
              totalLabel={c("cart.total", "Total")}
              totalValue={money(orderTotal)}
              /*
                This line used to say "SSL encrypted" — a property of the
                deployment that this page cannot vouch for. What the code does
                guarantee is server-side revalidation at order time, and stating
                exactly that is what makes the figure above credible.
              */
              note={c(
                "cart.provenance",
                "Totalled from the lines as saved · price, VAT, availability and any coupon are re-validated and priced by the server when the order is placed",
              )}
              lede={
                // The destination is a real fact about these lines, read off the
                // channel each was added on, and naming it is what stops a B2B
                // buyer pressing "checkout" and landing somewhere they did not
                // expect. It is also the moment the storefront admits it is
                // procurement software.
                destination.valid ? (
                  <StatusPill tone={isPurchaseOrder ? "accent" : "neutral"} className="mt-2">
                    {isPurchaseOrder
                      ? c("cart.destination.b2b", "B2B · continues as a purchase order")
                      : c("cart.destination.b2c", "B2C · continues to checkout")}
                  </StatusPill>
                ) : undefined
              }
              footer={
                <>
                  {(!summary.valid || !destination.valid) && (
                    <Surface rung={1} tone="danger" role="alert" className="mt-4 p-3">
                      <p className="u-meta text-danger-ink">
                        {c(
                          "cart.inconsistent",
                          "Cart currency, VAT, or sales channel is inconsistent. Separate B2B and B2C items before continuing.",
                        )}
                      </p>
                    </Surface>
                  )}

                  {summary.valid && destination.valid ? (
                    <Button asChild variant="primary" size="lg" className="mt-4 w-full">
                      <Link href={destination.href}>
                        {commitLabel}
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="primary" size="lg" className="mt-4 w-full" disabled>
                      {c("cart.unavailable", "Checkout unavailable")}
                    </Button>
                  )}
                </>
              }
            >
              <MoneyRow label={c("cart.subtotal", "Subtotal")} note={lineCount} value={money(subtotal)} />
              <MoneyRow label={c("cart.vat", "VAT")} value={money(summary.valid ? summary.vatAmount : 0)} />
            </Receipt>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
