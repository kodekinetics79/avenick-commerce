"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { formatCurrency } from "@avenick/utils";
import {
  Button,
  Eyebrow,
  FieldWell,
  ImageFrame,
  Layer,
  PriceStack,
  QuantityLadder,
  StatusPill,
} from "@avenick/ui";
import { MoneyRow } from "@/app/cart/_money-path";
import { cartDestination, summarizeCartCommercial } from "@/lib/cart-commercial";
import type { Currency } from "@/lib/market-context";
import {
  cartLineNeedsRepricing,
  cartQuantityBounds,
  cartQuantityChangeHref,
  useCartStore,
  type CartItem,
} from "@/stores/cart";
import { cartLineKey, useCartDrawerStore } from "./cart-drawer-store";
import { CompletionRow } from "./completion-row";
import {
  cartLineName,
  completionsNotInCart,
  ladderTiersFrom,
  type CartCompletionRow,
  type CartCompletionsLoader,
} from "./completions";
import { useCartCompletions } from "./use-cart-completions";

/**
 * THE CART DRAWER — what opens when a buyer adds to the cart, instead of a
 * page change.
 *
 * It is the shared <Layer> docked to the inline END: `side="end"` is logical,
 * so it arrives from the right in English and from the left in Arabic, and its
 * travel is multiplied by --dir inside the layer keyframes rather than by
 * anything here. Rung 5 with the modal blur, which this panel EARNS: the page
 * the buyer was shopping is still there behind it, dimmed and softened, not
 * replaced — that is the entire argument for glass at this rung, and why the
 * drawer never navigates on add.
 *
 * Focus trapping, Escape, outside-press dismissal and scroll lock all come
 * from Radix through <Layer>. Two things are added here, both because
 * <Layer> is opened from state rather than from a Radix trigger:
 *
 *   RETURN OF FOCUS. Radix's modal content prevents the focus scope's own
 *   return and focuses its DialogTrigger instead — and a <Layer> has none,
 *   so a keyboard user closing it would be dropped on <body>. The store
 *   records the control that had focus when the drawer opened (the card's
 *   add-to-cart button) and it is focused the moment the drawer closes,
 *   before the panel unmounts and while the trap is already released.
 *
 *   `aria-modal`. Radix expresses modality by aria-hiding the rest of the
 *   document rather than by the attribute, and <Layer> exposes no content
 *   props to set it through, so it is stamped on the dialog element as soon
 *   as the panel's body attaches — a callback ref, because the portal mounts
 *   its content one render after the open flag flips.
 *
 * Reduced motion is the stylesheet's contract — the layer's transform is
 * zeroed and its animation collapses to 1ms — and needs no code here.
 *
 * It closes on a route change. Every link in it — the product name, "View
 * cart", "Checkout" — leaves the drawer hanging over the page it just took the
 * buyer to otherwise; the route is the only reliable signal that its job is
 * done. It never opens on page load: its open flag is not persisted, and only
 * `openFor` (called after a real `addItem`) sets it.
 */
export interface CartDrawerProps {
  /**
   * Rows for "You might also need", already shaped as `CartCompletionRow`.
   * When given they are rendered as-is (minus anything already in the cart)
   * and take precedence over rows in the drawer store. Empty means the slot is
   * absent — it is never padded.
   */
  completions?: CartCompletionRow[];
  /**
   * A stable async provider of rows for the current cart's product ids; see
   * `CartCompletionsLoader`. Runs while the drawer is open and on the cart
   * page, and writes into the store both slots read from.
   */
  loadCompletions?: CartCompletionsLoader;
}

type Locale = "en" | "ar";

const STEP_BUTTON =
  "u-focus grid h-control-sm w-control-sm place-items-center rounded-nested text-ink-2 " +
  "transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 " +
  "disabled:opacity-40 disabled:hover:bg-transparent aria-disabled:opacity-40 aria-disabled:pointer-events-none";

const ALSO_NEED_ID = "cart-drawer-also-need";

const money = (value: number, currency: string, locale: Locale) =>
  formatCurrency(value, currency as Currency, locale);

export function CartDrawer({ completions, loadCompletions }: CartDrawerProps) {
  const t = useTranslations("cart");
  const tc = useTranslations("catalogue");
  const locale: Locale = useLocale() === "ar" ? "ar" : "en";
  const pathname = usePathname();

  const items = useCartStore((s) => s.items);
  const setQty = useCartStore((s) => s.setQty);
  const open = useCartDrawerStore((s) => s.open);
  const setOpen = useCartDrawerStore((s) => s.setOpen);
  const lastAddedKey = useCartDrawerStore((s) => s.lastAddedKey);
  const lastAddedBands = useCartDrawerStore((s) => s.lastAddedBands);
  const storedCompletions = useCartDrawerStore((s) => s.completions);

  useCartCompletions(loadCompletions, open || pathname === "/cart");

  // A tap on any link navigates client-side and would leave the drawer over the
  // next page. The first run is skipped: the effect fires once on mount, and an
  // unconditional close there is harmless today but wrong in principle.
  const seenRoute = React.useRef(pathname);
  React.useEffect(() => {
    if (seenRoute.current === pathname) return;
    seenRoute.current = pathname;
    setOpen(false);
  }, [pathname, setOpen]);

  // See the header comment: stamped through a callback ref, because the
  // panel does not exist yet in the commit that flips `open`.
  const bodyRef = React.useCallback((node: HTMLDivElement | null) => {
    node?.closest('[role="dialog"]')?.setAttribute("aria-modal", "true");
  }, []);

  // See the header comment: hand focus back to the control that opened the
  // drawer. Runs on the open→closed transition only, and only while that
  // control is still in the document — after a route change it is not, and
  // focusing a detached node is a no-op with a stack trace.
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const target = useCartDrawerStore.getState().returnFocusTo;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }, [open]);

  const close = React.useCallback(() => setOpen(false), [setOpen]);

  const line = React.useMemo(
    () => items.find((item) => cartLineKey(item.productId, item.variantId) === lastAddedKey) ?? null,
    [items, lastAddedKey],
  );
  const summary = summarizeCartCommercial(items);
  const destination = cartDestination(items);
  const isPurchaseOrder = destination.valid && destination.href.startsWith("/b2b");
  // The channel the suggestions are priced and routed for: the featured line's
  // own, failing that the cart's destination. A B2B buyer is never handed a
  // consumer row from inside a B2B cart.
  const channel: "B2C" | "B2B" = line?.channel ?? (isPurchaseOrder ? "B2B" : "B2C");
  const suggested = completionsNotInCart(completions ?? storedCompletions, items);
  const count = items.length;

  const footer = (
    <div className="flex w-full flex-col gap-2">
      {destination.valid ? (
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href={destination.href} onClick={close}>
            {isPurchaseOrder ? t("drawer.purchaseOrder") : t("checkout")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        // Mixed channels, mixed currencies or nothing in the cart: there is no
        // one destination to send the buyer to, and the note above the footer
        // says why. A control that leads nowhere is disabled, not hidden.
        <Button variant="primary" size="lg" className="w-full" disabled>
          {t("checkout")}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="secondary" size="md">
          <Link href="/cart" onClick={close}>
            {t("drawer.viewCart")}
          </Link>
        </Button>
        {/* Closes the layer; Radix then returns focus to the control that
            added the line, so a keyboard user lands back on the tile. */}
        <Button type="button" variant="ghost" size="md" onClick={close}>
          {t("continueShopping")}
        </Button>
      </div>
    </div>
  );

  return (
    <Layer
      open={open}
      onOpenChange={setOpen}
      side="end"
      size="md"
      title={t("drawer.title")}
      description={t("drawer.lineCount", { count, qty: String(count) })}
      closeLabel={t("drawer.close")}
      footer={footer}
    >
      <div ref={bodyRef} className="flex flex-col gap-5">
        {line ? (
          <FeaturedLine
            line={line}
            bands={lastAddedBands}
            locale={locale}
            onSet={(qty) => setQty(line.id, qty)}
            onNavigate={close}
          />
        ) : (
          <p className="u-body text-ink-2">{t("empty")}</p>
        )}

        {/* The running subtotal, stated on the same basis as the cart page:
            summarizeCartCommercial builds it from unitPrice × qty and adds VAT
            on top, so the subtotal is VAT-EXCLUSIVE and says so under its
            label. Recessed, because a breakdown is context, not an action. */}
        <div>
          <FieldWell className="divide-y divide-hairline px-4 py-2">
            <MoneyRow
              label={t("subtotal")}
              note={t("drawer.exclVat")}
              value={summary.valid ? money(summary.subtotal, summary.currency, locale) : "—"}
            />
            <MoneyRow
              label={t("vat")}
              value={summary.valid ? money(summary.vatAmount, summary.currency, locale) : "—"}
            />
          </FieldWell>
          <p className="u-meta mt-2 text-ink-3">
            {summary.valid && destination.valid ? t("drawer.basis") : t("drawer.mixed")}
          </p>
        </div>

        {/* "You might also need" — present only when there is something to
            say. An empty list is no section at all, not a heading over nothing. */}
        {suggested.length > 0 && (
          <section aria-labelledby={ALSO_NEED_ID}>
            <Eyebrow as="h3" id={ALSO_NEED_ID}>
              {/* The heading follows the basis the route reported. "Others also
                  bought" is a claim about other buyers and is only ever shown
                  when the service found two distinct ones; affinity rows are
                  headed as what they are. */}
              {suggested[0]?.basis === "related" ? t("drawer.alsoRelated") : t("drawer.alsoNeed")}
            </Eyebrow>
            <ul className="mt-1 divide-y divide-hairline">
              {suggested.map((row) => (
                <CompletionRow key={row.id} row={row} channel={channel} locale={locale} onNavigate={close} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </Layer>
  );
}

/**
 * The line just added: the same record the cart page draws, at the same
 * frame, with its quantity control and — for a B2B or otherwise tiered line —
 * the ladder its unit price was resolved from, with the band the quantity
 * falls in marked.
 */
function FeaturedLine({
  line,
  bands,
  locale,
  onSet,
  onNavigate,
}: {
  line: CartItem;
  bands: readonly { minQty: number; maxQty: number | null; amount: number }[] | null;
  locale: Locale;
  onSet: (qty: number) => void;
  onNavigate: () => void;
}) {
  const t = useTranslations("cart");
  const tc = useTranslations("catalogue");
  const name = cartLineName(line, locale);
  const href = cartQuantityChangeHref(line);
  const priced = Number.isFinite(line.unitPrice) && Number.isInteger(line.qty) && line.qty > 0;
  const unit = priced ? money(line.unitPrice, line.currency, locale) : null;
  const total = priced ? money(line.unitPrice * line.qty, line.currency, locale) : null;
  const tiers = ladderTiersFrom(bands, line.currency, locale);

  return (
    <div>
      <Eyebrow as="p">{t("drawer.justAdded")}</Eyebrow>
      <div className="mt-2 flex gap-4">
        <Link href={href} aria-hidden="true" tabIndex={-1} onClick={onNavigate} className="block shrink-0">
          <ImageFrame sku={line.sku} className="w-[72px] overflow-hidden rounded-nested">
            {line.imageUrl ? <Image src={line.imageUrl} alt="" fill sizes="72px" /> : undefined}
          </ImageFrame>
        </Link>
        <div className="min-w-0 flex-1">
          <h3 className="u-body font-medium">
            <Link
              href={href}
              onClick={onNavigate}
              className="u-focus line-clamp-2 rounded-nested text-ink-1 transition-colors duration-press ease-standard hover:text-primary-ink"
            >
              {name}
            </Link>
          </h3>
          <p className="u-mono u-meta mt-1 text-ink-3">{line.sku}</p>
          {total && unit ? (
            <PriceStack
              className="mt-2"
              rank="inline"
              amount={total}
              vat={
                line.vatRate != null
                  ? `${t("drawer.eachUnit", { amount: unit })} · ${tc("vatExcl", { rate: String(line.vatRate) })}`
                  : t("drawer.eachUnit", { amount: unit })
              }
            />
          ) : (
            // A line with no recorded price cannot print a figure without
            // inventing one; the cart page carries the notice.
            <p className="u-ui mt-2 font-medium text-primary-ink">{tc("quoteOnRequest")}</p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <DrawerStepper line={line} name={name} onSet={onSet} onNavigate={onNavigate} />
      </div>

      {tiers.length > 1 && (
        <div className="mt-3 border-t border-hairline pt-2.5">
          <QuantityLadder
            tiers={tiers}
            activeQty={line.qty}
            max={3}
            caption={tc("ladder.caption")}
            headers={{ qty: tc("ladder.qty"), unitPrice: tc("ladder.unit") }}
          />
          {tiers.length > 3 && (
            <p className="u-meta mt-1.5 text-ink-3">
              {tc("ladder.more", { count: tiers.length - 3, formatted: String(tiers.length - 3) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The quantity control, with the cart page's rule intact: a flat-priced line
 * is edited in place, clamped to [MOQ, CART_QTY_MAX] by the store; a tiered
 * line (every B2B line, and a B2C line the catalogue flagged) was priced for
 * the quantity it holds, so its "−"/"+" are links to the product page at the
 * new quantity, where the tier is re-resolved before the line is replaced.
 * Nothing here re-prices a tier itself — that would be a figure the server
 * never charges.
 *
 * No motion on the figure: a stepper is a hundred-presses-a-day control and
 * the number between the buttons is what the buyer pays against.
 */
function DrawerStepper({
  line,
  name,
  onSet,
  onNavigate,
}: {
  line: CartItem;
  name: string;
  onSet: (qty: number) => void;
  onNavigate: () => void;
}) {
  const t = useTranslations("cart");
  const tc = useTranslations("catalogue");
  const { min, max } = cartQuantityBounds(line);
  const atMin = line.qty <= min;
  const atMax = line.qty >= max;
  const tiered = cartLineNeedsRepricing(line);
  // A disabled end keeps a harmless target (the current quantity) so an
  // assistive-tech activation can never request a quantity below the MOQ, and
  // the label names exactly the quantity the link will ask for.
  const downTo = atMin ? line.qty : line.qty - 1;
  const upTo = atMax ? line.qty : line.qty + 1;
  const repriceAt = (qty: number) => t("drawer.repriceAt", { count: qty, qty: String(qty) });

  if (tiered && !line.slug) {
    // A line persisted before slugs were stored cannot be repriced from here.
    return (
      <span className="u-ui font-medium text-ink-1">
        {t("quantity")} <span className="tnum">{line.qty}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FieldWell
        className="inline-flex items-center rounded-nested p-0"
        role="group"
        aria-label={`${t("quantity")} — ${name}`}
      >
        {tiered ? (
          <Link
            href={cartQuantityChangeHref(line, downTo)}
            aria-disabled={atMin}
            tabIndex={atMin ? -1 : undefined}
            aria-label={repriceAt(downTo)}
            title={repriceAt(downTo)}
            onClick={onNavigate}
            className={STEP_BUTTON}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            disabled={atMin}
            aria-label={t("drawer.decrease")}
            onClick={() => onSet(line.qty - 1)}
            className={STEP_BUTTON}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <span className="tnum min-w-[2.5rem] px-2 text-center text-ui font-medium text-ink-1" aria-live="polite">
          {line.qty}
        </span>
        {tiered ? (
          <Link
            href={cartQuantityChangeHref(line, upTo)}
            aria-disabled={atMax}
            tabIndex={atMax ? -1 : undefined}
            aria-label={repriceAt(upTo)}
            title={repriceAt(upTo)}
            onClick={onNavigate}
            className={STEP_BUTTON}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            disabled={atMax}
            aria-label={t("drawer.increase")}
            onClick={() => onSet(line.qty + 1)}
            className={STEP_BUTTON}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </FieldWell>
      {tiered && <StatusPill tone="accent">{t("drawer.tiered")}</StatusPill>}
      {min > 1 && (
        <span className="u-meta text-ink-3">{tc("minOrder", { count: min, qty: String(min) })}</span>
      )}
    </div>
  );
}
