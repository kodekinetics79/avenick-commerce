"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Info, ShoppingCart, TicketPercent } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Dateline, EmptyState, Eyebrow, Input, Skeleton, StatusPill, Surface } from "@avenick/ui";
import { cn, formatCurrency } from "@avenick/utils";
import { cartQuantityChangeHref, useCartStore, type CartItem } from "@/stores/cart";
import { summarizeCartCommercial } from "@/lib/cart-commercial";
import { emptyMarketAddress, SUPPORTED_COUNTRIES } from "@/lib/market-context";
import { copyFrom, LineFrame } from "@/app/cart/_money-path";
import {
  ADDRESS_FIELD_ORDER,
  ADDRESS_LIMITS,
  preflightCheckout,
  productFactsFromCatalogDetail,
  type AddressField,
  type AddressFieldError,
  type CheckoutAddress,
  type LineFacts,
  type PreflightNotice,
  type PreflightRefusal,
  type PreflightResult,
} from "@/lib/checkout-preflight";
import type { ShippingCoverage } from "@/lib/checkout-shipping-coverage";
import { CheckoutField } from "./checkout-field";
import { CheckoutSummary } from "./checkout-summary";
import { CheckoutTrustStrip } from "./checkout-trust-strip";
import { OrderConfirmation, type PostedOrderFigures } from "./order-confirmation";
import { paymentMethodsFor } from "./payment-methods";

type Step = "address" | "payment" | "review" | "success";

interface OrderResult {
  id: string;
  orderNumber: string;
  posted: PostedOrderFigures;
  idempotent: boolean;
  paymentMethod: string;
}

/**
 * The three steps a buyer walks, in order. "success" is an outcome, not a
 * step, so it can never appear in the progress rail.
 */
const STEPS: { id: Exclude<Step, "success">; key: string; fallback: string }[] = [
  { id: "address", key: "checkout.step.address", fallback: "Address" },
  { id: "payment", key: "checkout.step.payment", fallback: "Payment" },
  { id: "review", key: "checkout.step.review", fallback: "Review" },
];

/**
 * A recessed native control, matching <Input>'s rung-1 treatment. A native
 * <select> hands a phone its own full-screen wheel, keeps the form's `required`
 * semantics, and works with no JavaScript, which matters more for a country
 * picker than a styled popover.
 */
const SELECT_CONTROL =
  "u-focus w-full rounded-lg border border-input bg-surface-1 px-3 text-ui text-ink-1 " +
  "transition-[border-color,box-shadow] duration-press ease-standard disabled:opacity-50 " +
  "aria-[invalid=true]:border-danger-rule";

/* ── THE DRAFT ────────────────────────────────────────────────────────────
   The cart is persisted by its store; the address, the payment choice and a
   typed code were React state, and a buyer who stepped back to the cart to
   add one more line lost all three. "Missed something?" can only promise
   that everything is kept if everything is kept, so the draft lives in
   sessionStorage for the life of the tab and is cleared on submission.
   Every access is guarded: storage can be absent or throw, and the page must
   render correctly with no draft at all. */
const DRAFT_KEY = "avenick-checkout-draft";

interface CheckoutDraft {
  address: CheckoutAddress;
  paymentMethod: string;
  couponCode: string;
}

function readDraft(): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;
    const a = parsed.address;
    if (!a || typeof a.label !== "string" || typeof a.line1 !== "string" || typeof a.city !== "string" || typeof a.country !== "string") return null;
    return {
      address: { label: a.label, line1: a.line1, city: a.city, country: a.country },
      paymentMethod: typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : "",
      couponCode: typeof parsed.couponCode === "string" ? parsed.couponCode : "",
    };
  } catch {
    return null;
  }
}

function writeDraft(draft: CheckoutDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable: the form still works, it just does not remember */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}

type Action = { href: string; label: string } | { onClick: () => void; label: string };
interface Described {
  message: string;
  action?: Action;
}

const RFQ_HREF = "/b2b/rfq/new";
const PURCHASE_ORDER_HREF = "/b2b/purchase-orders/new";

export interface CheckoutFormProps {
  /** The delivery tariff's shape, or null when it could not be read. */
  coverage: ShippingCoverage | null;
  /** The order route's own MOCK gate (PILOT_MODE && ALLOW_MOCK_PAYMENTS). */
  mockPaymentsEnabled: boolean;
}

export function CheckoutForm({ coverage, mockPaymentsEnabled }: CheckoutFormProps) {
  const t = useTranslations();
  const c = copyFrom(t);
  const locale = useLocale() === "ar" ? "ar" : "en";
  const { items, clearCart } = useCartStore();
  const paymentMethods = useMemo(() => paymentMethodsFor(mockPaymentsEnabled), [mockPaymentsEnabled]);

  const [step, setStep] = useState<Step>("address");
  const [paymentMethod, setPaymentMethod] = useState<string>(mockPaymentsEnabled ? "MOCK" : "BANK_TRANSFER");
  const [couponCode, setCouponCode] = useState("");
  // Empty rather than pre-filled with "Home": the label is a value the buyer
  // types, and seeding it with an English word put an English word inside an
  // Arabic form the moment the page loaded.
  const [address, setAddress] = useState<CheckoutAddress>(() => emptyMarketAddress(""));
  // Field errors appear after the first attempt to continue, then live.
  const [addressAttempted, setAddressAttempted] = useState(false);
  const [facts, setFacts] = useState<Record<string, LineFacts | undefined>>({});
  const [loading, setLoading] = useState(false);
  // A failed submission lands next to the button that produced it, in a live
  // region, and focus moves to it — never a window.alert().
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  // The cart is persisted in localStorage, so the first render on both server
  // and client sees an empty one. Without this gate a buyer arriving with a
  // full cart is shown "nothing to check out" for a frame.
  const [hydrated, setHydrated] = useState(false);

  const idempotencyKeyRef = useRef<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const line1Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setAddress(draft.address);
      setCouponCode(draft.couponCode);
      if (paymentMethods.some((method) => method.id === draft.paymentMethod && method.enabled)) {
        setPaymentMethod(draft.paymentMethod);
      }
    }
    setHydrated(true);
    // Runs once, on mount: the draft is read before the first interactive paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || step === "success") return;
    writeDraft({ address, paymentMethod, couponCode });
  }, [hydrated, step, address, paymentMethod, couponCode]);

  // Moving between steps swaps the whole panel, which unmounts the button the
  // buyer just pressed; focus would fall to <body>. It moves to the new step's
  // heading instead, which names where the buyer now is. Skipped on first
  // paint so the page never steals focus on arrival.
  const hasChangedStep = useRef(false);
  useEffect(() => {
    if (!hasChangedStep.current) {
      hasChangedStep.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  const summary = summarizeCartCommercial(items);
  // No fallback currency: an invalid cart never reaches the order call.
  const checkoutCurrency = summary.valid ? summary.currency : null;

  /* ── THE CATALOGUE'S OWN FACTS ─────────────────────────────────────────
     Each line is re-read from /api/products/[slug] — the projection the
     product page itself renders — for the facts createOrder will check:
     current MOQ, active variants, stock, weight, channel. A 404 is recorded as
     a catalogue miss; a failed read leaves the line unverified, and the
     preflight says so rather than guessing. B2B lines are not read: they are
     routed to the purchase-order flow regardless. */
  const factsSignature = items
    .map((item) => `${item.id}:${item.productId}:${item.slug ?? ""}:${item.variantId ?? ""}:${item.channel ?? ""}`)
    .sort()
    .join("|");
  useEffect(() => {
    if (!hydrated || !checkoutCurrency) return;
    const lines = items.filter((item) => item.channel !== "B2B" && item.slug);
    if (lines.length === 0) return;
    const controller = new AbortController();
    (async () => {
      const dtoBySlug = new Map<string, unknown>();
      await Promise.all(
        [...new Set(lines.map((line) => line.slug!))].map(async (slug) => {
          try {
            const res = await fetch(
              `/api/products/${encodeURIComponent(slug)}?currency=${encodeURIComponent(checkoutCurrency)}`,
              { signal: controller.signal, headers: { Accept: "application/json" } },
            );
            if (res.status === 404) {
              dtoBySlug.set(slug, "MISS");
              return;
            }
            if (!res.ok) return;
            const json = (await res.json()) as { success?: boolean; data?: unknown };
            if (json?.success) dtoBySlug.set(slug, json.data);
          } catch {
            /* unverified */
          }
        }),
      );
      if (controller.signal.aborted) return;
      const next: Record<string, LineFacts | undefined> = {};
      for (const line of lines) {
        const dto = dtoBySlug.get(line.slug!);
        if (dto === "MISS") next[line.id] = { productId: line.productId, unavailable: true };
        else if (dto !== undefined) next[line.id] = productFactsFromCatalogDetail(dto, line.variantId) ?? undefined;
      }
      setFacts(next);
    })();
    return () => controller.abort();
    // The signature captures every line field the read depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, checkoutCurrency, factsSignature]);

  const preflight = useMemo<PreflightResult>(
    () =>
      preflightCheckout({
        lines: items.map((item) => ({
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
          moq: item.moq,
          currency: item.currency,
          channel: item.channel,
          vatRate: item.vatRate,
        })),
        address,
        currency: checkoutCurrency ?? "",
        coverage,
        facts,
      }),
    [items, address, checkoutCurrency, coverage, facts],
  );

  const countryName = (code: string) =>
    c(`checkout.countries.${code}`, SUPPORTED_COUNTRIES.find(([iso]) => iso === code)?.[1] ?? code);
  const lineName = (item: CartItem) => (locale === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr);
  const itemById = (id: string) => items.find((item) => item.id === id);
  const money = (value: number, currency: string) => formatCurrency(value, currency as never, locale);
  const zoneName = preflight.delivery.kind === "QUOTED"
    ? (locale === "ar" ? preflight.delivery.zone.nameAr || preflight.delivery.zone.nameEn : preflight.delivery.zone.nameEn)
    : "";

  function addressErrorCopy(field: AddressField, code: AddressFieldError): string {
    const limits = field === "country" ? null : ADDRESS_LIMITS[field];
    switch (code) {
      case "REQUIRED":
        return c("checkout.address.error.required", "This field is required.");
      case "TOO_SHORT":
        return c("checkout.address.error.tooShort", `Enter at least ${limits?.min ?? 1} characters.`, { min: String(limits?.min ?? 1) });
      case "TOO_LONG":
        return c("checkout.address.error.tooLong", `Use at most ${limits?.max ?? 0} characters.`, { max: String(limits?.max ?? 0) });
      case "UNSUPPORTED_COUNTRY":
        return c("checkout.address.error.unsupportedCountry", "Orders can be delivered within the GCC only.");
    }
  }

  const destinationRefusal = preflight.refusals.find(
    (refusal): refusal is Extract<PreflightRefusal, { kind: "DESTINATION_UNSERVED" | "DESTINATION_AMBIGUOUS" | "DESTINATION_UNSUPPORTED" }> =>
      refusal.kind === "DESTINATION_UNSERVED" || refusal.kind === "DESTINATION_AMBIGUOUS" || refusal.kind === "DESTINATION_UNSUPPORTED",
  );
  const destinationName = address.country ? countryName(address.country) : "";
  const unservedCopy = c("checkout.address.unserved", `We don’t deliver to ${destinationName} yet.`, { country: destinationName });
  const ambiguousCopy = c(
    "checkout.address.ambiguous",
    `Delivery to ${destinationName} can’t be priced right now — the tariff for it needs attention.`,
    { country: destinationName },
  );

  const visibleAddressErrors = addressAttempted ? preflight.addressErrors : {};
  const countryError = visibleAddressErrors.country
    ? addressErrorCopy("country", visibleAddressErrors.country)
    : destinationRefusal?.kind === "DESTINATION_UNSERVED"
      ? unservedCopy
      : destinationRefusal?.kind === "DESTINATION_AMBIGUOUS"
        ? ambiguousCopy
        : null;
  const countryHint = !address.country
    ? c("checkout.address.countryHint", "VAT and delivery follow this country.")
    : preflight.delivery.kind === "QUOTED"
      ? c("checkout.address.served", `Delivered by ${zoneName} · quoted by weight when you submit`, { zone: zoneName })
      : preflight.delivery.kind === "NOT_CONFIGURED"
        ? c("checkout.summary.deliveryNotConfigured", "No delivery tariff is configured — nothing is added for delivery")
        : c("checkout.summary.deliveryQuoted", "Quoted by the server when you submit");

  function focusField(field: AddressField) {
    const ref = { label: labelRef, line1: line1Ref, city: cityRef, country: countryRef }[field];
    ref.current?.focus();
  }

  function continueToPayment() {
    setAddressAttempted(true);
    const errors = preflight.addressErrors;
    const first = ADDRESS_FIELD_ORDER.find((field) => errors[field]) ?? (destinationRefusal ? "country" : undefined);
    if (first) {
      focusField(first);
      return;
    }
    setStep("payment");
  }

  /* ── REFUSALS AND NOTICES, IN WORDS A BUYER CAN ACT ON ──────────────────
     Each refusal names the line, the rule, and the one place to fix it. The
     server error each mirrors is documented on the PreflightRefusal type. */
  function describeRefusal(refusal: PreflightRefusal): Described {
    const cartAction: Action = { href: "/cart", label: c("checkout.action.editCart", "Edit cart") };
    const productAction = (item: CartItem | undefined, label: string, qty?: number): Action =>
      item?.slug ? { href: cartQuantityChangeHref(item, qty), label } : cartAction;
    switch (refusal.kind) {
      case "MIXED_CURRENCY":
        return { message: c("checkout.mixedCurrency", "Remove items in other currencies before checkout."), action: cartAction };
      case "B2B_LINES": {
        const count = refusal.lineIds.length;
        return {
          message: c(
            "checkout.refusal.b2bLines",
            `${count} line${count === 1 ? " is" : "s are"} B2B-priced. B2B orders are placed through a purchase order, not this checkout.`,
            { count, n: String(count) },
          ),
          action: { href: PURCHASE_ORDER_HREF, label: c("checkout.action.createPurchaseOrder", "Create purchase order") },
        };
      }
      case "DESTINATION_UNSUPPORTED":
        return {
          message: c("checkout.address.error.unsupportedCountry", "Orders can be delivered within the GCC only."),
          action: { onClick: () => setStep("address"), label: c("checkout.action.changeAddress", "Change address") },
        };
      case "DESTINATION_UNSERVED":
        return { message: unservedCopy, action: { href: RFQ_HREF, label: c("checkout.action.requestQuote", "Request a quote") } };
      case "DESTINATION_AMBIGUOUS":
        return { message: ambiguousCopy, action: { href: "/support", label: c("checkout.action.contactSupport", "Contact support") } };
      case "RATE_UNAVAILABLE":
        return {
          message: c(
            "checkout.refusal.rateUnavailable",
            `Delivery by ${zoneName} isn’t priced in ${refusal.currency}. Ask for a quote instead.`,
            { zone: zoneName, currency: refusal.currency },
          ),
          action: { href: RFQ_HREF, label: c("checkout.action.requestQuote", "Request a quote") },
        };
      case "BELOW_MOQ": {
        const item = itemById(refusal.lineId);
        const name = item ? lineName(item) : refusal.lineId;
        return {
          message: c(
            "checkout.refusal.belowMoq",
            `Minimum order quantity for ${name} is ${refusal.moq}; you have ${refusal.qty}.`,
            { name, moq: String(refusal.moq), qty: String(refusal.qty) },
          ),
          action: productAction(item, c("checkout.action.changeQuantity", "Change quantity"), refusal.moq),
        };
      }
      case "VARIANT_REQUIRED": {
        const item = itemById(refusal.lineId);
        const name = item ? lineName(item) : refusal.lineId;
        return {
          message: c("checkout.refusal.variantRequired", `${name} needs a variant chosen before it can be ordered.`, { name }),
          action: productAction(item, c("checkout.action.chooseVariant", "Choose a variant")),
        };
      }
      case "VARIANT_UNAVAILABLE": {
        const item = itemById(refusal.lineId);
        const name = item ? lineName(item) : refusal.lineId;
        return {
          message: c("checkout.refusal.variantUnavailable", `The chosen variant of ${name} is no longer available.`, { name }),
          action: productAction(item, c("checkout.action.chooseAnother", "Choose another")),
        };
      }
      case "CHANNEL_NOT_B2C": {
        const item = itemById(refusal.lineId);
        const name = item ? lineName(item) : refusal.lineId;
        return {
          message: c("checkout.refusal.channelNotB2c", `${name} isn’t available for consumer ordering.`, { name }),
          action: { href: "/cart", label: c("checkout.action.removeInCart", "Remove in cart") },
        };
      }
      case "INSUFFICIENT_STOCK": {
        const item = itemById(refusal.lineId);
        const name = item ? lineName(item) : refusal.lineId;
        if (refusal.unconfirmed) {
          return {
            message: c(
              "checkout.refusal.stockUnconfirmed",
              `Stock for ${name} hasn’t been confirmed by the seller, so this order would be refused.`,
              { name },
            ),
            action: { href: "/cart", label: c("checkout.action.removeInCart", "Remove in cart") },
          };
        }
        return {
          message: c(
            "checkout.refusal.insufficientStock",
            `Only ${refusal.available} of ${name} available; you have ${refusal.qty}.`,
            { name, available: String(refusal.available), qty: String(refusal.qty) },
          ),
          action: refusal.available > 0
            ? productAction(item, c("checkout.action.changeQuantity", "Change quantity"), refusal.available)
            : { href: "/cart", label: c("checkout.action.removeInCart", "Remove in cart") },
        };
      }
    }
  }

  function describeNotice(notice: PreflightNotice): Described {
    switch (notice.kind) {
      case "DELIVERY_FALLBACK_RATE": {
        const names = notice.lineIds.map((id) => (itemById(id) ? lineName(itemById(id)!) : id)).join(locale === "ar" ? "، " : ", ");
        const price = checkoutCurrency ? money(notice.fallbackPrice, checkoutCurrency) : String(notice.fallbackPrice);
        return {
          message: c(
            "checkout.notice.fallbackRate",
            `${names}: no recorded weight, so delivery is charged at the zone’s flat rate of ${price} rather than by weight.`,
            { names, price },
          ),
        };
      }
      case "CATALOGUE_MISS": {
        const item = itemById(notice.lineId);
        const name = item ? lineName(item) : notice.lineId;
        return {
          message: c(
            "checkout.notice.catalogueMiss",
            `${name} couldn’t be found in the catalogue. If it has been withdrawn the order will be refused — remove it in the cart to be sure.`,
            { name },
          ),
          action: { href: "/cart", label: c("checkout.action.editCart", "Edit cart") },
        };
      }
      case "FACTS_UNVERIFIED": {
        const count = notice.lineIds.length;
        return {
          message: c(
            "checkout.notice.unverified",
            `${count} line${count === 1 ? "" : "s"} couldn’t be re-checked against the catalogue; the server checks ${count === 1 ? "it" : "them"} when you submit.`,
            { count, n: String(count) },
          ),
        };
      }
    }
  }

  async function placeOrder() {
    setLoading(true);
    setSubmitError(null);
    try {
      if (!checkoutCurrency) throw new Error("Cart items must use one currency per checkout");
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = globalThis.crypto?.randomUUID?.() ?? `checkout-${Date.now()}-${Math.random()}`;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          // Cart price and seller are display hints only. The server re-resolves
          // both from the authoritative catalog at checkout.
          items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.qty })),
          shippingAddress: address,
          paymentMethod,
          currency: checkoutCurrency,
          type: "B2C",
          couponCode: couponCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const num = (value: unknown) => (value == null || !Number.isFinite(Number(value)) ? null : Number(value));
        setOrderResult({
          id: String(data.data.id),
          orderNumber: String(data.data.orderNumber),
          posted: {
            total: num(data.data.total),
            discountAmount: num(data.data.discountAmount),
            vatAmount: num(data.data.vatAmount),
            currency: typeof data.data.currency === "string" ? data.data.currency : checkoutCurrency,
          },
          idempotent: data.idempotent === true,
          paymentMethod,
        });
        clearDraft();
        clearCart();
        setStep("success");
      } else {
        // The server's own refusal is shown verbatim when it sends one: it
        // names the line or the rule that stopped the order.
        setSubmitError(data.error ?? c("checkout.orderFailed", "Order failed"));
      }
    } catch {
      setSubmitError(c("checkout.orderFailedRetry", "Order failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated && step !== "success") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-block" aria-hidden="true">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-9 w-52" />
        <div className="mt-block grid grid-cols-3 gap-2 sm:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="h-0.5 w-full rounded-none" />
              <Skeleton className="mt-2.5 h-7 w-28" />
            </div>
          ))}
        </div>
        <div className="mt-block grid grid-cols-1 gap-block lg:grid-cols-[minmax(0,1fr)_minmax(320px,404px)]">
          <Skeleton className="h-80 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (step === "success" && orderResult) {
    return (
      <OrderConfirmation
        c={c}
        locale={locale}
        orderId={orderResult.id}
        orderNumber={orderResult.orderNumber}
        posted={orderResult.posted}
        paymentMethod={orderResult.paymentMethod}
        idempotent={orderResult.idempotent}
        countryName={countryName}
        headingRef={stepHeadingRef}
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-section">
        <EmptyState
          variant="certificate"
          eyebrow={c("checkout.empty.eyebrow", "Nothing to check out")}
          headline={c("checkout.empty.headline", "There is nothing in your cart to check out.")}
          body={c("checkout.empty.body", "Add items from the marketplace and they will be waiting here.")}
          action={
            <Button asChild variant="primary" size="lg">
              <Link href="/products">
                {c("checkout.browse", "Browse products")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!summary.valid || !checkoutCurrency) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-section">
        <EmptyState
          variant="certificate"
          eyebrow={c("checkout.unpriceable.eyebrow", "Checkout unavailable")}
          headline={c("checkout.unpriceable.headline", "This cart cannot be priced.")}
          body={c(
            "checkout.unpriceable.body",
            "Cart items must have one currency and complete VAT facts. No estimate or order has been submitted.",
          )}
          action={
            <Button asChild variant="primary" size="lg">
              <Link href="/cart">{c("checkout.reviewCart", "Review cart")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const hasRefusals = preflight.refusals.length > 0;

  const renderAction = (action: Action | undefined) => {
    if (!action) return null;
    const className = "u-focus u-ui inline-flex items-center gap-1 rounded-nested font-medium text-primary-ink hover:underline";
    return "href" in action ? (
      <Link href={action.href} className={className}>
        {action.label}
        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
      </Link>
    ) : (
      <button type="button" onClick={action.onClick} className={className}>
        {action.label}
        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-block">
      <header className="mb-stack border-b border-border-strong pb-4">
        <Eyebrow>{c("checkout.eyebrow", "Checkout")}</Eyebrow>
        <h1 className="u-h1 mt-1 text-ink-1">{c("checkout.title", "Checkout")}</h1>
        <Dateline className="mt-1.5">
          {c("checkout.dateline", "Three steps · nothing is charged and no order exists until you submit the last one")}
        </Dateline>
      </header>

      {/* THE PROGRESS RAIL: a real ordered list, the current step carrying
          aria-current, the brass rule drawn over it as decoration only. */}
      <ol className="mb-block grid grid-cols-3 gap-2 sm:gap-4">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li key={s.id} aria-current={active ? "step" : undefined} className="min-w-0">
              <div className="h-0.5 w-full bg-hairline" aria-hidden="true">
                <div className="u-drawn" data-on={done || active ? "true" : "false"} />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-pill text-meta font-medium",
                    "transition-colors duration-panel ease-standard",
                    done
                      ? "bg-success-soft text-success-ink ring-1 ring-success-rule"
                      : active
                        ? "bg-primary text-primary-foreground shadow-seam"
                        : "bg-surface-1 text-ink-3 shadow-elev-1",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("u-ui truncate", active ? "font-medium text-ink-1" : done ? "text-ink-2" : "text-ink-3")}>
                  {c(s.key, s.fallback)}
                </span>
              </div>
              <span className="sr-only">
                {done
                  ? c("checkout.step.completed", "completed")
                  : active
                    ? c("checkout.step.current", "current step")
                    : c("checkout.step.notStarted", "not started")}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-block lg:grid-cols-[minmax(0,1fr)_minmax(320px,404px)]">
        <div key={step} className="u-pop min-w-0">
          {step === "address" && (
            <Surface rung={2} className="p-5 sm:p-6">
              <form noValidate onSubmit={(event) => { event.preventDefault(); continueToPayment(); }}>
              <h2 ref={stepHeadingRef} tabIndex={-1} className="u-h3 u-focus rounded-nested text-ink-1 outline-none">
                {c("checkout.deliveryAddress", "Delivery address")}
              </h2>
              <p className="u-meta mt-1 text-ink-3">{c("checkout.address.hint", "Where the supplier ships this order.")}</p>

              <div className="mt-5 space-y-1">
                <CheckoutField
                  id="ck-label"
                  label={c("checkout.address.label", "Address label")}
                  required
                  hint={c("checkout.address.labelHint", "For example Home or Office.")}
                  error={visibleAddressErrors.label ? addressErrorCopy("label", visibleAddressErrors.label) : null}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      ref={labelRef}
                      value={address.label}
                      maxLength={ADDRESS_LIMITS.label.max}
                      autoComplete="off"
                      onChange={(event) => setAddress({ ...address, label: event.target.value })}
                      className={a11y["aria-invalid"] ? "border-danger-rule" : undefined}
                    />
                  )}
                </CheckoutField>
                <CheckoutField
                  id="ck-line1"
                  label={c("checkout.address.line1", "Street address")}
                  required
                  error={visibleAddressErrors.line1 ? addressErrorCopy("line1", visibleAddressErrors.line1) : null}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      ref={line1Ref}
                      value={address.line1}
                      maxLength={ADDRESS_LIMITS.line1.max}
                      autoComplete="street-address"
                      onChange={(event) => setAddress({ ...address, line1: event.target.value })}
                      placeholder={c("checkout.address.line1Placeholder", "Building, street")}
                      className={a11y["aria-invalid"] ? "border-danger-rule" : undefined}
                    />
                  )}
                </CheckoutField>
                <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                  <CheckoutField
                    id="ck-city"
                    label={c("checkout.address.city", "City")}
                    required
                    error={visibleAddressErrors.city ? addressErrorCopy("city", visibleAddressErrors.city) : null}
                  >
                    {(a11y) => (
                      <Input
                        {...a11y}
                        ref={cityRef}
                        value={address.city}
                        maxLength={ADDRESS_LIMITS.city.max}
                        autoComplete="address-level2"
                        onChange={(event) => setAddress({ ...address, city: event.target.value })}
                        className={a11y["aria-invalid"] ? "border-danger-rule" : undefined}
                      />
                    )}
                  </CheckoutField>
                  <CheckoutField
                    id="ck-country"
                    label={c("checkout.address.country", "Country")}
                    required
                    hint={countryHint}
                    error={countryError}
                  >
                    {(a11y) => (
                      <select
                        {...a11y}
                        ref={countryRef}
                        value={address.country}
                        autoComplete="country"
                        onChange={(event) => setAddress({ ...address, country: event.target.value })}
                        data-rung={1}
                        className={SELECT_CONTROL}
                        style={{ height: "var(--control-h-md)" }}
                      >
                        <option value="" disabled>{c("checkout.address.selectCountry", "Select country")}</option>
                        {SUPPORTED_COUNTRIES.map(([code, name]) => (
                          <option key={code} value={code}>{c(`checkout.countries.${code}`, name)}</option>
                        ))}
                      </select>
                    )}
                  </CheckoutField>
                </div>
              </div>

              {/* A destination the tariff refuses is stated the moment it is
                  chosen, with the one path that exists for it: a request for
                  quotation, which reaches suppliers who can price delivery
                  there. The server would otherwise refuse this order with a
                  500 after the third step. */}
              {destinationRefusal && destinationRefusal.kind !== "DESTINATION_UNSUPPORTED" && (
                <Surface rung={1} tone="danger" role="alert" className="mt-4 p-4">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="u-ui font-medium text-danger-ink">
                        {destinationRefusal.kind === "DESTINATION_UNSERVED" ? unservedCopy : ambiguousCopy}
                      </p>
                      <p className="u-meta mt-1 text-ink-2">
                        {destinationRefusal.kind === "DESTINATION_UNSERVED"
                          ? c(
                              "checkout.address.unservedBody",
                              "No delivery tariff covers this country, so the order would be refused. A request for quotation reaches suppliers who can arrange delivery there, or choose another delivery country.",
                            )
                          : c(
                              "checkout.address.ambiguousBody",
                              "More than one delivery tariff claims this country and the platform refuses to choose between them. Contact support, or choose another delivery country.",
                            )}
                      </p>
                      <div className="mt-3">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={destinationRefusal.kind === "DESTINATION_UNSERVED" ? RFQ_HREF : "/support"}>
                            {destinationRefusal.kind === "DESTINATION_UNSERVED"
                              ? c("checkout.action.requestQuote", "Request a quote")
                              : c("checkout.action.contactSupport", "Contact support")}
                            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Surface>
              )}

              <Button type="submit" className="mt-5 w-full" size="lg">
                {c("checkout.continueToPayment", "Continue to payment")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Button>
              </form>
            </Surface>
          )}

          {step === "payment" && (
            <Surface rung={2} className="p-5 sm:p-6">
              <h2 ref={stepHeadingRef} tabIndex={-1} className="u-h3 u-focus rounded-nested text-ink-1 outline-none">
                {c("checkout.paymentMethod", "Payment method")}
              </h2>

              {mockPaymentsEnabled && (
                <Surface rung={1} tone="accent" className="mt-4 p-3">
                  <p className="u-meta text-ink-2">
                    {c(
                      "checkout.pilotNotice",
                      "Pilot mode is explicitly enabled. Test payment records are simulation-only and never represent a card charge.",
                    )}
                  </p>
                </Surface>
              )}

              {/* Native radios in a fieldset: the visual selection and the
                  announced selection are the same fact, and arrow keys work. */}
              <fieldset className="mt-5">
                <legend className="sr-only">{c("checkout.paymentMethod", "Payment method")}</legend>
                <div className="space-y-2">
                  {paymentMethods.map((pm) => {
                    const selected = paymentMethod === pm.id;
                    return (
                      <label
                        key={pm.id}
                        className={cn(
                          "relative flex items-start gap-3 overflow-hidden rounded-lg border p-3",
                          "transition-colors duration-press ease-standard",
                          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                          "has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface-2",
                          pm.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-55",
                          selected ? "border-primary bg-primary-soft" : pm.enabled ? "border-border hover:border-border-strong" : "border-border",
                        )}
                      >
                        <span className="absolute inset-y-0 start-0 flex w-0.5" aria-hidden="true">
                          <span className="u-drawn h-full" data-orientation="vertical" data-on={selected ? "true" : "false"} />
                        </span>
                        <input
                          type="radio"
                          name="payment-method"
                          value={pm.id}
                          checked={selected}
                          disabled={!pm.enabled}
                          onChange={() => setPaymentMethod(pm.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-primary"
                        />
                        <pm.icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-primary-ink" : "text-ink-3")} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="u-ui block font-medium text-ink-1">{c(pm.labelKey, pm.label)}</span>
                          <span className="u-meta block text-ink-3">{c(pm.descKey, pm.desc)}</span>
                        </span>
                        {!pm.enabled && (
                          <StatusPill tone="neutral" className="mt-0.5 shrink-0">
                            {c("checkout.notEnabled", "Not enabled")}
                          </StatusPill>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-5 flex gap-3">
                <Button variant="outline" size="lg" onClick={() => setStep("address")}>{c("checkout.back", "Back")}</Button>
                <Button className="flex-1" size="lg" onClick={() => setStep("review")}>
                  {c("checkout.reviewOrder", "Review order")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Button>
              </div>
            </Surface>
          )}

          {step === "review" && (
            <Surface rung={2} className="overflow-hidden">
              <div className="p-5 pb-4 sm:p-6 sm:pb-4">
                <h2 ref={stepHeadingRef} tabIndex={-1} className="u-h3 u-focus rounded-nested text-ink-1 outline-none">
                  {c("checkout.reviewTitle", "Review your order")}
                </h2>
                <Dateline className="mt-1">
                  {c(
                    "checkout.reviewProvenance",
                    "Lines as held in this browser · the server re-resolves each product, its price and its VAT before the order is written",
                  )}
                </Dateline>
              </div>

              <ul className="divide-y divide-hairline border-y border-hairline">
                {items.map((item) => (
                  <li key={item.id} className="u-frame-host flex items-center gap-3 px-5 py-3 sm:px-6">
                    <LineFrame width="w-[52px]" sku={item.sku}>
                      {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="52px" /> : undefined}
                    </LineFrame>
                    <div className="min-w-0 flex-1">
                      <p className="u-ui truncate font-medium text-ink-1">{lineName(item)}</p>
                      <p className="u-meta text-ink-3">
                        <span className="tnum">{item.qty}</span>
                        {" × "}
                        <span className="tnum">{money(item.unitPrice, item.currency)}</span>
                        {" · "}
                        {item.vatRate != null
                          ? c("cart.exclVatRate", `Excl. VAT ${item.vatRate}%`, { rate: item.vatRate })
                          : c("checkout.vatMissing", "VAT rate not recorded")}
                      </p>
                    </div>
                    <span className="fig shrink-0 text-ui text-ink-1">{money(item.unitPrice * item.qty, item.currency)}</span>
                  </li>
                ))}
              </ul>

              <div className="p-5 pt-5 sm:p-6">
                {/* Delivery, restated at the moment of commitment. */}
                <p className="u-meta text-ink-2">
                  <span className="text-ink-3">{c("checkout.review.deliveringTo", "Delivering to")}</span>{" "}
                  {[address.line1, address.city, countryName(address.country)].filter(Boolean).join(", ")}
                  {" · "}
                  <button type="button" onClick={() => setStep("address")} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
                    {c("checkout.action.changeAddress", "Change address")}
                  </button>
                </p>

                <div className="mt-4">
                  <CheckoutField
                    id="coupon-code"
                    label={c("checkout.coupon", "Coupon / event code")}
                    hint={c(
                      "checkout.couponHint",
                      "Validated against current eligibility, usage limits and stacking rules when you submit. The browser does not calculate or authorize the discount.",
                    )}
                  >
                    {(a11y) => (
                      <Input
                        {...a11y}
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                        maxLength={40}
                        placeholder={c("checkout.couponPlaceholder", "Optional code")}
                        startIcon={<TicketPercent className="h-4 w-4" aria-hidden="true" />}
                        className="u-mono"
                      />
                    )}
                  </CheckoutField>
                </div>

                {/* BEFORE YOU SUBMIT: every refusal the server is certain to
                    issue, and every fact worth knowing, stated here — where the
                    buyer can still fix it — rather than as a 409 or a 500 after. */}
                {(hasRefusals || preflight.notices.length > 0) && (
                  <div id="checkout-preflight" className="mt-4 space-y-3" aria-live="polite">
                    {hasRefusals && (
                      <Surface rung={1} tone="danger" className="p-4">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <h3 className="u-ui font-medium text-danger-ink">{c("checkout.preflight.title", "Before you submit")}</h3>
                            <p className="u-meta mt-0.5 text-ink-2">
                              {c("checkout.preflight.body", "The server would refuse this order as it stands. Each point names where to fix it; your cart and address are kept.")}
                            </p>
                            <ul className="mt-2 space-y-2">
                              {preflight.refusals.map((refusal, index) => {
                                const described = describeRefusal(refusal);
                                return (
                                  <li key={`${refusal.kind}-${index}`} className="u-ui text-ink-1">
                                    {described.message}{" "}
                                    {renderAction(described.action)}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      </Surface>
                    )}
                    {preflight.notices.length > 0 && (
                      <Surface rung={1} tone="accent" className="p-4">
                        <div className="flex items-start gap-2.5">
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                          <ul className="min-w-0 flex-1 space-y-2">
                            {preflight.notices.map((notice, index) => {
                              const described = describeNotice(notice);
                              return (
                                <li key={`${notice.kind}-${index}`} className="u-meta text-ink-2">
                                  {described.message}{" "}
                                  {renderAction(described.action)}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </Surface>
                    )}
                  </div>
                )}

                {submitError && (
                  <Surface ref={errorRef} rung={1} tone="danger" role="alert" tabIndex={-1} className="u-focus mt-4 p-3 outline-none">
                    <p className="u-ui text-danger-ink">{submitError}</p>
                  </Surface>
                )}

                <div className="mt-5 flex gap-3">
                  <Button variant="outline" size="lg" onClick={() => setStep("payment")}>{c("checkout.back", "Back")}</Button>
                  {/* The one primary control on the page, and the only one on
                      the money path that writes an order. Disabled only while
                      a refusal is listed above it, which the button points at. */}
                  <Button
                    className="flex-1"
                    size="lg"
                    loading={loading}
                    disabled={!preflight.canSubmit}
                    aria-describedby={hasRefusals ? "checkout-preflight" : undefined}
                    onClick={placeOrder}
                  >
                    {c("checkout.placeOrder", "Submit order")}
                  </Button>
                </div>
              </div>
            </Surface>
          )}
        </div>

        {/* The running summary follows the buyer down all three steps, with the
            way back to the cart and the four assurances beneath it. */}
        <aside className="space-y-stack lg:sticky lg:top-24 lg:self-start">
          <CheckoutSummary
            c={c}
            locale={locale}
            currency={checkoutCurrency}
            subtotal={summary.subtotal}
            vatEstimate={summary.vatAmount}
            estimate={summary.total}
            lineCount={items.length}
            couponCode={couponCode}
            preflight={preflight}
            countryName={address.country ? countryName(address.country) : null}
          />

          {/* MISSED SOMETHING? The cart is client state and this draft is kept
              for the tab, so the promise below is a description of what
              happens, not a hope. */}
          <Surface rung={1} className="p-4">
            <div className="flex items-start gap-2.5">
              <ShoppingCart className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              <div className="min-w-0">
                <p className="u-ui font-medium text-ink-1">{c("checkout.missed.title", "Missed something?")}</p>
                <p className="u-meta mt-0.5 text-ink-2">
                  {c(
                    "checkout.missed.body",
                    "Go back to your cart to add or change lines. Your cart, this address, the payment choice and any code stay exactly as they are — nothing is submitted until the last step.",
                  )}
                </p>
                <Link href="/cart" className="u-focus u-ui mt-2 inline-flex items-center gap-1 rounded-nested font-medium text-primary-ink hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                  {c("checkout.missed.action", "Back to cart")}
                </Link>
              </div>
            </div>
          </Surface>

          <CheckoutTrustStrip c={c} locale={locale} />
        </aside>
      </div>
    </div>
  );
}
