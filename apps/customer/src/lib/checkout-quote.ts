/**
 * THE SERVER'S QUOTE, BEFORE SUBMISSION.
 *
 * POST /api/v1/checkout/quote prices a basket the way createOrder will — the
 * same price tiers, the same promotions engine, the same quoteShipping, the
 * same composeOrderTotals — and answers with the seven-field OrderTotals plus
 * how delivery was priced. It is the only place before submission where the
 * server's own figures exist, so when it answers, the checkout shows THOSE and
 * states nothing of its own.
 *
 * It is consumed structurally, without importing the contract package. The
 * route and packages/contracts are being landed by another track, and this
 * page must render — falling back to stating the server's rules — whether or
 * not that endpoint is deployed. The shape below mirrors CheckoutQuoteSchema in
 * packages/contracts/src/checkout.ts field for field; once that package is
 * committed, parseServerQuote can be replaced by its safeParse.
 *
 * A quote that does not reconcile — VAT that is not the sum of its two halves,
 * a total that is not the sum of its lines — is rejected here and never
 * printed. The browser must not show figures that do not add up, whoever
 * produced them. It computes no money of its own: the checks are comparisons
 * in integer cents of figures the server already fixed.
 */

import type { AddressErrors, CheckoutAddress, PreflightLine } from "./checkout-preflight";

export const QUOTE_ENDPOINT = "/api/v1/checkout/quote";

/** The request body, exactly the keys the contract's strict schema accepts. */
export interface QuoteRequestBody {
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  shippingAddress: { label: string; line1: string; city: string; country: string };
  currency: string;
  channel: "B2C";
  couponCode?: string;
}

export type QuoteShippingStatus = "priced" | "unpriced_no_zones" | "unavailable";

export interface ServerQuote {
  quoteId: string;
  currency: string;
  /** The order's place-of-supply VAT rate, in percent. */
  vatRatePercent: number;
  lines: Array<{
    productId: string;
    variantId: string | null;
    quantity: number;
    unitPrice: number;
    vatRatePercent: number;
    vatAmount: number;
    lineTotal: number;
    nameEn: string;
    nameAr: string;
  }>;
  shipping: {
    status: QuoteShippingStatus;
    zoneName: string | null;
    amount: number;
    vatRatePercent: number;
  };
  promotions: Array<{ label: string; couponCode: string | null; discountAmount: number }>;
  totals: {
    subtotal: number;
    discountAmount: number;
    goodsVatAmount: number;
    shippingAmount: number;
    shippingVatAmount: number;
    vatAmount: number;
    total: number;
  };
  /** Epoch milliseconds after which the quote is no longer the price. */
  expiresAt: number;
}

/**
 * Why a quote could not be shown. REFUSED is a server answer the order route
 * would give too — the basket, the code or the destination is wrong — and it
 * stops submission with the server's own words. UNAVAILABLE is anything else:
 * the endpoint is not deployed, throttled, faulting, or answered a shape this
 * parser does not recognise. Then the browser states the server's rules and
 * the server's refusal, if any, stands at submission — exactly as before a
 * quote existed.
 */
export type QuoteFailure =
  | { kind: "REFUSED"; code: string; message: string; fieldErrors: Record<string, string[]> }
  | { kind: "UNAVAILABLE"; status: number | null };

/** Error codes on which the order route would refuse the same request. */
const BLOCKING_CODES = new Set(["validation_failed", "conflict", "not_found", "forbidden"]);

const MIN_COUPON_LENGTH = 3;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const cents = (value: number) => Math.round(value * 100);

export function buildQuoteRequest(input: {
  lines: readonly PreflightLine[];
  address: CheckoutAddress;
  currency: string;
  couponCode: string;
}): QuoteRequestBody {
  const coupon = input.couponCode.trim();
  return {
    items: input.lines.map((line) => ({
      productId: line.productId,
      ...(line.variantId ? { variantId: line.variantId } : {}),
      quantity: line.qty,
    })),
    shippingAddress: {
      label: input.address.label.trim(),
      line1: input.address.line1.trim(),
      city: input.address.city.trim(),
      country: input.address.country.trim().toUpperCase(),
    },
    currency: input.currency,
    channel: "B2C",
    ...(coupon.length >= MIN_COUPON_LENGTH ? { couponCode: coupon } : {}),
  };
}

/**
 * Whether a quote is worth asking for: the request would pass the contract's
 * own validation. Asking with a half-typed address only spends the buyer's
 * rate-limit budget on a 400.
 */
export function canRequestQuote(input: {
  lines: readonly PreflightLine[];
  addressErrors: AddressErrors;
  currency: string | null;
  couponCode: string;
}): boolean {
  const coupon = input.couponCode.trim();
  return (
    input.lines.length > 0
    && input.lines.every((line) => line.channel !== "B2B" && Number.isInteger(line.qty) && line.qty > 0)
    && input.currency != null
    && Object.keys(input.addressErrors).length === 0
    && (coupon.length === 0 || coupon.length >= MIN_COUPON_LENGTH)
  );
}

/** A stable identity for a request, so a late answer is never shown for a changed basket. */
export function quoteSignature(request: QuoteRequestBody): string {
  return JSON.stringify(request);
}

export function parseServerQuote(json: unknown): ServerQuote | null {
  if (typeof json !== "object" || json === null) return null;
  const q = json as Record<string, unknown>;
  const quoteId = str(q.quoteId);
  const currency = str(q.currency);
  const vatRatePercent = num(q.vatRatePercent);
  const expiresAt = typeof q.expiresAt === "string" ? Date.parse(q.expiresAt) : NaN;
  if (!quoteId || !currency || vatRatePercent == null || !Number.isFinite(expiresAt)) return null;

  const totalsRaw = typeof q.totals === "object" && q.totals !== null ? (q.totals as Record<string, unknown>) : null;
  if (!totalsRaw) return null;
  const totals = {
    subtotal: num(totalsRaw.subtotal),
    discountAmount: num(totalsRaw.discountAmount),
    goodsVatAmount: num(totalsRaw.goodsVatAmount),
    shippingAmount: num(totalsRaw.shippingAmount),
    shippingVatAmount: num(totalsRaw.shippingVatAmount),
    vatAmount: num(totalsRaw.vatAmount),
    total: num(totalsRaw.total),
  };
  if (Object.values(totals).some((value) => value == null)) return null;
  const t = totals as Record<keyof typeof totals, number>;
  // The two identities the contract enforces, checked again here in cents:
  // declared VAT is both halves, and the total is the sum of the lines.
  if (cents(t.goodsVatAmount) + cents(t.shippingVatAmount) !== cents(t.vatAmount)) return null;
  if (cents(t.subtotal) - cents(t.discountAmount) + cents(t.goodsVatAmount) + cents(t.shippingAmount) + cents(t.shippingVatAmount) !== cents(t.total)) return null;

  const shippingRaw = typeof q.shipping === "object" && q.shipping !== null ? (q.shipping as Record<string, unknown>) : null;
  const shippingStatus = str(shippingRaw?.status);
  const shippingAmount = num(shippingRaw?.amount);
  const shippingRate = num(shippingRaw?.vatRatePercent);
  if (!shippingRaw || !shippingStatus || shippingAmount == null || shippingRate == null) return null;
  if (shippingStatus !== "priced" && shippingStatus !== "unpriced_no_zones" && shippingStatus !== "unavailable") return null;
  if (cents(shippingAmount) !== cents(t.shippingAmount)) return null;

  const linesRaw = Array.isArray(q.lines) ? (q.lines as Array<Record<string, unknown>>) : null;
  if (!linesRaw || linesRaw.length === 0) return null;
  const lines: ServerQuote["lines"] = [];
  for (const line of linesRaw) {
    const productId = str(line.productId);
    const quantity = num(line.quantity);
    const unitPrice = num(line.unitPrice);
    const lineRate = num(line.vatRatePercent);
    const vatAmount = num(line.vatAmount);
    const lineTotal = num(line.lineTotal);
    if (!productId || quantity == null || unitPrice == null || lineRate == null || vatAmount == null || lineTotal == null) return null;
    lines.push({
      productId,
      variantId: str(line.variantId),
      quantity,
      unitPrice,
      vatRatePercent: lineRate,
      vatAmount,
      lineTotal,
      nameEn: str(line.nameEn) ?? "",
      nameAr: str(line.nameAr) ?? "",
    });
  }

  const promotionsRaw = Array.isArray(q.promotions) ? (q.promotions as Array<Record<string, unknown>>) : [];
  const promotions: ServerQuote["promotions"] = [];
  for (const promotion of promotionsRaw) {
    const discountAmount = num(promotion.discountAmount);
    if (discountAmount == null) return null;
    promotions.push({ label: str(promotion.label) ?? "", couponCode: str(promotion.couponCode), discountAmount });
  }

  return {
    quoteId,
    currency,
    vatRatePercent,
    lines,
    shipping: { status: shippingStatus, zoneName: str(shippingRaw.zoneName), amount: shippingAmount, vatRatePercent: shippingRate },
    promotions,
    totals: t,
    expiresAt,
  };
}

/** Read the v1 error envelope `{ error: { code, message, requestId, fieldErrors? } }`. */
export function parseQuoteFailure(status: number, json: unknown): QuoteFailure {
  const envelope = typeof json === "object" && json !== null ? (json as Record<string, unknown>).error : null;
  const error = typeof envelope === "object" && envelope !== null ? (envelope as Record<string, unknown>) : null;
  const code = str(error?.code);
  const message = str(error?.message);
  if (!code || !message || !BLOCKING_CODES.has(code)) return { kind: "UNAVAILABLE", status };
  const fieldErrors: Record<string, string[]> = {};
  const raw = typeof error?.fieldErrors === "object" && error?.fieldErrors !== null ? (error.fieldErrors as Record<string, unknown>) : {};
  for (const [path, messages] of Object.entries(raw)) {
    if (Array.isArray(messages)) {
      const clean = messages.filter((m): m is string => typeof m === "string");
      if (clean.length > 0) fieldErrors[path] = clean;
    }
  }
  return { kind: "REFUSED", code, message, fieldErrors };
}

export function isQuoteFresh(quote: Pick<ServerQuote, "expiresAt">, now = Date.now()): boolean {
  return quote.expiresAt > now;
}

/** The server's own words about the coupon, if the refusal was about it. */
export function couponErrorFrom(failure: QuoteFailure | null): string | null {
  if (!failure || failure.kind !== "REFUSED") return null;
  return failure.fieldErrors.couponCode?.[0] ?? null;
}
