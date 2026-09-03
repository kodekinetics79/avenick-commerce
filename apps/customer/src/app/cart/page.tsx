"use client";

import Link from "next/link";
import Image from "next/image";
import { Trash2, ShoppingBag, ArrowRight, Heart, Minus, Plus } from "lucide-react";
import {
  Button, Dateline, EmptyState, Eyebrow, FieldWell, Num, PageHeader, StatusPill, Surface,
} from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import { cartLineNeedsRepricing, cartQuantityBounds, cartQuantityChangeHref, useCartStore, type CartItem } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { MainLayout } from "@/components/layout/main-layout";
import { cartDestination, summarizeCartCommercial } from "@/lib/cart-commercial";

const STEP_BUTTON =
  "u-focus grid h-control-sm w-control-sm place-items-center rounded-nested text-ink-2 " +
  "transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 " +
  "disabled:opacity-40 disabled:hover:bg-transparent aria-disabled:opacity-40 aria-disabled:pointer-events-none";

const LINE_ACTION =
  "u-focus inline-flex items-center gap-1.5 rounded-nested px-2 py-1 text-meta text-ink-3 " +
  "transition-colors duration-press ease-standard";

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
 */
function lineNotice(
  item: CartItem,
  mixedCurrency: boolean,
  mixedChannel: boolean,
): { tone: "danger" | "warning"; label: string } | null {
  if (!Number.isFinite(item.unitPrice)) return { tone: "danger", label: "Unit price not recorded" };
  if (!Number.isInteger(item.qty) || item.qty <= 0) return { tone: "danger", label: "Quantity not recorded" };
  if (item.vatRate == null || !Number.isFinite(item.vatRate) || item.vatRate < 0) {
    return { tone: "danger", label: "VAT rate not recorded" };
  }
  // summarizeCartCommercial filters falsy currencies out before it counts them,
  // so a line with no currency at all is folded into whatever the other lines
  // are priced in and never blocks the total. That silence is the reason it has
  // to be said on the line: warning rather than danger, because the cart is
  // still checkoutable and a danger pill beside an enabled button is a lie
  // about which state the buyer is in.
  if (!item.currency) return { tone: "warning", label: "Currency not recorded" };
  if (mixedCurrency) return { tone: "warning", label: `Priced in ${item.currency}` };
  if (!item.channel) return { tone: "warning", label: "Sales channel not recorded" };
  if (mixedChannel) return { tone: "warning", label: `${item.channel} line` };
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
 */
function lineMoney(item: CartItem, amount: number): string {
  const priced = Number.isFinite(item.unitPrice) && Number.isInteger(item.qty) && item.qty > 0;
  if (!priced || !Number.isFinite(amount)) return "—";
  return formatCurrency(amount, item.currency as never);
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
 */
function QuantityStepper({ item, onSet }: { item: CartItem; onSet: (qty: number) => void }) {
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

  if (tiered && !item.slug) {
    // A line persisted before slugs were stored cannot be repriced from here.
    return <span className="tnum text-ui font-medium text-ink-1">Qty {item.qty}</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Recessed on purpose: law A reads "recessed = context or input", and a
          quantity control is the canonical input. Pressed into the card, it also
          stops competing with the raised checkout button for attention. */}
      <FieldWell className="inline-flex items-center rounded-nested p-0" role="group" aria-label={`Quantity for ${item.nameEn}`}>
        {tiered ? (
          <Link
            // Disabled links keep a harmless target (the current quantity) so an
            // assistive-tech activation can never request a quantity below the MOQ.
            href={cartQuantityChangeHref(item, downTo)}
            aria-disabled={atMin}
            tabIndex={atMin ? -1 : undefined}
            aria-label={`Reprice at ${downTo} units`}
            title={`Reprice at ${downTo} units on the product page`}
            className={STEP_BUTTON}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" disabled={atMin} aria-label="Decrease quantity" onClick={() => onSet(item.qty - 1)} className={STEP_BUTTON}>
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
            aria-label={`Reprice at ${upTo} units`}
            title={`Reprice at ${upTo} units on the product page`}
            className={STEP_BUTTON}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" disabled={atMax} aria-label="Increase quantity" onClick={() => onSet(item.qty + 1)} className={STEP_BUTTON}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </FieldWell>
      {tiered && <StatusPill tone="accent">Quantity-tiered · repriced on the product page</StatusPill>}
      {!tiered && min > 1 && atMin && <span className="text-meta text-ink-3">Minimum {min}</span>}
    </div>
  );
}

export default function CartPage() {
  const { items, removeItem, setQty } = useCartStore();
  const { toggle } = useWishlist();
  const summary = summarizeCartCommercial(items);
  const destination = cartDestination(items);
  const subtotal = summary.valid ? summary.subtotal : 0;
  const orderTotal = summary.valid ? summary.total : 0;
  // Computed once for the whole list: a line is only "the odd currency" or "the
  // odd channel" relative to the rest of the cart, so the test cannot live
  // inside the row.
  const mixedCurrency = new Set(items.map((i) => i.currency)).size > 1;
  const mixedChannel = new Set(items.map((i) => i.channel)).size > 1;
  const money = (value: number) => (summary.valid ? formatCurrency(value, summary.currency as never) : "—");

  function saveForLater(item: typeof items[0]) {
    if (!item.slug) return;
    // `inStock` records that the line was addable when it was saved, not a live
    // availability check — the wishlist labels it that way rather than promising
    // the buyer the item is in stock right now.
    toggle({ id: item.productId, slug: item.slug, channel: item.channel, variantId: item.variantId, nameEn: item.nameEn, nameAr: item.nameAr, imageUrl: item.imageUrl, price: item.unitPrice, quantity: item.qty, moq: item.moq, vatRate: item.vatRate, currency: item.currency, sku: item.sku, sellerId: item.sellerId, inStock: true });
    removeItem(item.id);
  }

  if (items.length === 0) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-3xl px-4 py-section">
          <Surface rung={2}>
            <EmptyState
              eyebrow="Nothing in the cart"
              headline="Your cart is empty."
              body="Anything you add from the marketplace is held here, in this browser, until you check out."
              icon={<ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />}
              action={
                <div className="flex flex-col items-center gap-4">
                  {/* The Arabic mirror is tagged rather than left as loose glyphs
                      in an English document, so it is announced in Arabic and
                      shaped right-to-left wherever it renders. It reads BEFORE
                      the button: it restates the headline, and a translation
                      printed underneath a call to action reads as a caption on
                      the button rather than as the same sentence again. */}
                  <p lang="ar" dir="rtl" className="text-ui text-ink-2">سلة التسوق فارغة</p>
                  <Button asChild variant="primary" size="lg"><Link href="/products">Browse products</Link></Button>
                </div>
              }
            />
          </Surface>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-block">
        <PageHeader
          eyebrow="Cart"
          title="Shopping cart"
          dateline={`${items.length} line${items.length !== 1 ? "s" : ""} held in this browser · each price is the one recorded when the line was added`}
        />

        <div className="grid grid-cols-1 gap-block lg:grid-cols-3">
          {/*
            One panel divided by hairlines rather than N floating cards. A cart is
            read as a running list of what you are about to buy, and a receipt
            reads as one object; four bordered boxes read as four unrelated ones.
          */}
          <Surface rung={2} as="section" aria-label="Cart lines" className="overflow-hidden lg:col-span-2">
            <ul className="divide-y divide-hairline">
              {items.map((item) => {
                const notice = lineNotice(item, mixedCurrency, mixedChannel);
                return (
                  <li key={item.id} className="flex gap-4 p-4 sm:p-5">
                    <Link
                      href={cartQuantityChangeHref(item)}
                      aria-label={`Open ${item.nameEn}`}
                      className="u-focus relative h-20 w-20 shrink-0 overflow-hidden rounded-nested border border-hairline bg-surface-1"
                    >
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" fill className="object-cover" sizes="80px" />
                      ) : (
                        // Decorative: the link already carries the product's name,
                        // so the glyph must not be announced a second time.
                        <span className="grid h-full w-full place-items-center text-h3" aria-hidden="true">📦</span>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="line-clamp-1 text-body font-medium text-ink-1">{item.nameEn}</h2>
                          <p lang="ar" dir="rtl" className="line-clamp-1 text-meta text-ink-2">{item.nameAr}</p>
                          <p className="mt-0.5 text-meta text-ink-3">
                            SKU <span className="u-mono">{item.sku}</span>
                          </p>
                        </div>
                        <div className="shrink-0 text-end">
                          {/* The line total is the figure on this row, so it is the
                              only thing here at figure rank. Money is ink, not
                              indigo: the primary fill is reserved for the one
                              action that commits the order. */}
                          <Num value={lineMoney(item, item.unitPrice * item.qty)} />
                          <p className="mt-0.5 text-meta text-ink-3">
                            <span className="tnum">{lineMoney(item, item.unitPrice)}</span> each
                            {item.vatRate != null && <> · VAT {item.vatRate}%</>}
                          </p>
                        </div>
                      </div>

                      {notice && (
                        <StatusPill tone={notice.tone} dot className="mt-2.5">{notice.label}</StatusPill>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <QuantityStepper item={item} onSet={(qty) => setQty(item.id, qty)} />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => saveForLater(item)}
                            className={`${LINE_ACTION} hover:bg-primary-soft hover:text-primary-ink`}
                          >
                            <Heart className="h-3.5 w-3.5" aria-hidden="true" /> Save for later
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${item.nameEn} from the cart`}
                            onClick={() => removeItem(item.id)}
                            className={`${LINE_ACTION} hover:bg-danger-soft hover:text-danger-ink`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Surface>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Surface rung={2} className="p-5">
              <Eyebrow as="h2">Order summary</Eyebrow>

              {/* Recessed: the breakdown is the context you read on the way to the
                  total, not something you act on. */}
              <FieldWell className="mt-3 space-y-2 p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-ui text-ink-2">Subtotal · {items.length} line{items.length !== 1 ? "s" : ""}</span>
                  <span className="tnum text-ui text-ink-1">{money(subtotal)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-ui text-ink-2">VAT</span>
                  <span className="tnum text-ui text-ink-1">{money(summary.valid ? summary.vatAmount : 0)}</span>
                </div>
              </FieldWell>

              {/* The total gets the 2px underrule and section rank — it is the one
                  number on this page a buyer must not have to hunt for. */}
              <div className="mt-4 flex items-baseline justify-between gap-4 border-t-2 border-border-strong pt-4">
                <span className="text-ui font-medium text-ink-1">Total</span>
                <Num rank="section" value={money(orderTotal)} />
              </div>

              {/*
                This line used to say "SSL encrypted" — a property of the
                deployment that this page cannot vouch for. What the code does
                guarantee is server-side revalidation at order time, and stating
                exactly that is what makes the figure above credible.
              */}
              <Dateline className="mt-2">
                Totalled from the lines as saved · price, VAT, availability and any coupon are re-validated and priced by the server when the order is placed
              </Dateline>

              {(!summary.valid || !destination.valid) && (
                <p role="alert" className="mt-4 text-meta text-danger-ink">
                  Cart currency, VAT, or sales channel is inconsistent. Separate B2B and B2C items before continuing.
                </p>
              )}

              {summary.valid && destination.valid ? (
                <Button asChild variant="primary" size="lg" className="mt-4 w-full">
                  <Link href={destination.href}>
                    {destination.label}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <Button variant="primary" size="lg" className="mt-4 w-full" disabled>Checkout unavailable</Button>
              )}
            </Surface>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
