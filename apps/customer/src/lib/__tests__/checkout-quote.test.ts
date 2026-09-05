import { describe, expect, it } from "vitest";
import {
  buildQuoteRequest,
  canRequestQuote,
  couponErrorFrom,
  isQuoteFresh,
  parseQuoteFailure,
  parseServerQuote,
  quoteSignature,
} from "../checkout-quote";
import type { PreflightLine } from "../checkout-preflight";

const address = { label: " Office ", line1: "12 Sheikh Zayed Road", city: "Dubai", country: "ae" };
const line = (overrides: Partial<PreflightLine> = {}): PreflightLine => ({
  id: "l1", productId: "p1", qty: 2, currency: "AED", channel: "B2C", ...overrides,
});

/** A quote the way quote-service assembles one: composeOrderTotals' arithmetic, already rounded. */
const quote = {
  quoteId: "q1",
  currency: "AED",
  channel: "B2C",
  vatRatePercent: 5,
  lines: [
    { productId: "p1", variantId: null, sellerId: "s1", sku: "A", nameEn: "A", nameAr: "أ", quantity: 2, unitPrice: 500, vatRatePercent: 5, vatAmount: 45, lineTotal: 945 },
  ],
  shipping: { status: "priced", zoneName: "GCC mainland", amount: 25, vatRatePercent: 5, estimatedDaysMin: 2, estimatedDaysMax: 5 },
  promotions: [{ promotionId: "pr1", couponCode: "WELCOME10", label: "Welcome", discountAmount: 100 }],
  totals: { subtotal: 1000, discountAmount: 100, goodsVatAmount: 45, shippingAmount: 25, shippingVatAmount: 1.25, vatAmount: 46.25, total: 971.25 },
  expiresAt: "2026-09-05T12:00:00.000Z",
};

describe("buildQuoteRequest", () => {
  it("sends exactly the contract's keys, trimmed, and omits what is absent", () => {
    const body = buildQuoteRequest({ lines: [line(), line({ id: "l2", productId: "p2", variantId: "v1", qty: 1 })], address, currency: "AED", couponCode: "ab" });
    expect(body).toEqual({
      items: [{ productId: "p1", quantity: 2 }, { productId: "p2", variantId: "v1", quantity: 1 }],
      shippingAddress: { label: "Office", line1: "12 Sheikh Zayed Road", city: "Dubai", country: "AE" },
      currency: "AED",
      channel: "B2C",
    });
    expect(buildQuoteRequest({ lines: [line()], address, currency: "AED", couponCode: " welcome10 " }).couponCode).toBe("welcome10");
  });

  it("has a stable signature for the same basket", () => {
    const a = buildQuoteRequest({ lines: [line()], address, currency: "AED", couponCode: "" });
    const b = buildQuoteRequest({ lines: [line()], address: { ...address, label: "Office" }, currency: "AED", couponCode: "" });
    expect(quoteSignature(a)).toBe(quoteSignature(b));
    expect(quoteSignature(a)).not.toBe(quoteSignature({ ...a, currency: "SAR" }));
  });
});

describe("canRequestQuote", () => {
  it("asks only when the contract would accept the request", () => {
    const ok = { lines: [line()], addressErrors: {}, currency: "AED", couponCode: "" };
    expect(canRequestQuote(ok)).toBe(true);
    expect(canRequestQuote({ ...ok, lines: [] })).toBe(false);
    expect(canRequestQuote({ ...ok, lines: [line({ channel: "B2B" })] })).toBe(false);
    expect(canRequestQuote({ ...ok, addressErrors: { line1: "TOO_SHORT" } })).toBe(false);
    expect(canRequestQuote({ ...ok, currency: null })).toBe(false);
    expect(canRequestQuote({ ...ok, couponCode: "ab" })).toBe(false);
    expect(canRequestQuote({ ...ok, couponCode: "abc" })).toBe(true);
  });
});

describe("parseServerQuote", () => {
  it("reads a reconciling quote, with its expiry as epoch milliseconds", () => {
    const parsed = parseServerQuote(quote);
    expect(parsed).not.toBeNull();
    expect(parsed?.totals).toEqual(quote.totals);
    expect(parsed?.shipping).toEqual({ status: "priced", zoneName: "GCC mainland", amount: 25, vatRatePercent: 5 });
    expect(parsed?.promotions).toEqual([{ label: "Welcome", couponCode: "WELCOME10", discountAmount: 100 }]);
    expect(parsed?.lines[0]).toMatchObject({ productId: "p1", variantId: null, quantity: 2, unitPrice: 500, vatAmount: 45, lineTotal: 945 });
    expect(parsed?.expiresAt).toBe(Date.parse("2026-09-05T12:00:00.000Z"));
  });

  it("rejects a quote whose figures do not add up, whoever produced them", () => {
    // VAT that is only the goods half — the exact defect the contract exists to catch.
    expect(parseServerQuote({ ...quote, totals: { ...quote.totals, vatAmount: 45 } })).toBeNull();
    // A total that adds delivery after tax.
    expect(parseServerQuote({ ...quote, totals: { ...quote.totals, total: 970 } })).toBeNull();
    // A shipping figure that disagrees with the totals.
    expect(parseServerQuote({ ...quote, shipping: { ...quote.shipping, amount: 30 } })).toBeNull();
  });

  it("rejects an incomplete or unrecognisable shape rather than guessing", () => {
    expect(parseServerQuote({ ...quote, totals: { ...quote.totals, shippingVatAmount: undefined } })).toBeNull();
    expect(parseServerQuote({ ...quote, expiresAt: "soon" })).toBeNull();
    expect(parseServerQuote({ ...quote, shipping: { ...quote.shipping, status: "free" } })).toBeNull();
    expect(parseServerQuote({ ...quote, lines: [] })).toBeNull();
    expect(parseServerQuote(null)).toBeNull();
    expect(parseServerQuote("ok")).toBeNull();
  });

  it("accepts the zero-rated and unpriced cases the server really answers", () => {
    const qa = {
      ...quote,
      vatRatePercent: 0,
      lines: [{ ...quote.lines[0], vatRatePercent: 0, vatAmount: 0, lineTotal: 900 }],
      shipping: { status: "unpriced_no_zones", zoneName: null, amount: 0, vatRatePercent: 0, estimatedDaysMin: null, estimatedDaysMax: null },
      promotions: [],
      totals: { subtotal: 1000, discountAmount: 100, goodsVatAmount: 0, shippingAmount: 0, shippingVatAmount: 0, vatAmount: 0, total: 900 },
    };
    expect(parseServerQuote(qa)?.shipping.status).toBe("unpriced_no_zones");
  });
});

describe("parseQuoteFailure", () => {
  it("treats the codes the order route would refuse on as refusals, with the server's words", () => {
    const failure = parseQuoteFailure(422, {
      error: { code: "validation_failed", message: "Quantity is below the minimum.", requestId: "r1", fieldErrors: { "items.0.quantity": ["Minimum order quantity for \"A\" is 5."] } },
    });
    expect(failure).toEqual({
      kind: "REFUSED", code: "validation_failed", message: "Quantity is below the minimum.",
      fieldErrors: { "items.0.quantity": ["Minimum order quantity for \"A\" is 5."] },
    });
    expect(parseQuoteFailure(409, { error: { code: "conflict", message: "\"A\" is no longer available.", requestId: "r1" } })).toMatchObject({ kind: "REFUSED", code: "conflict" });
  });

  it("treats everything else — throttling, a missing endpoint, a fault — as unavailable, not as a refusal", () => {
    expect(parseQuoteFailure(429, { error: { code: "rate_limited", message: "Slow down", requestId: "r1" } })).toEqual({ kind: "UNAVAILABLE", status: 429 });
    expect(parseQuoteFailure(404, "<html>")).toEqual({ kind: "UNAVAILABLE", status: 404 });
    expect(parseQuoteFailure(500, { error: { code: "internal", message: "x", requestId: "r1" } })).toEqual({ kind: "UNAVAILABLE", status: 500 });
  });

  it("surfaces the coupon's own field error for the coupon field", () => {
    const refused = parseQuoteFailure(422, { error: { code: "validation_failed", message: "This coupon has expired.", requestId: "r1", fieldErrors: { couponCode: ["This coupon has expired."] } } });
    expect(couponErrorFrom(refused)).toBe("This coupon has expired.");
    expect(couponErrorFrom({ kind: "UNAVAILABLE", status: 500 })).toBeNull();
  });
});

describe("isQuoteFresh", () => {
  it("is a strict comparison against the quote's own expiry", () => {
    expect(isQuoteFresh({ expiresAt: 1_000 }, 999)).toBe(true);
    expect(isQuoteFresh({ expiresAt: 1_000 }, 1_000)).toBe(false);
  });
});
