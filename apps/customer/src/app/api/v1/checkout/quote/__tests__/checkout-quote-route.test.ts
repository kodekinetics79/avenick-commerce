import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CheckoutQuoteSchema, ErrorEnvelopeSchema, OrderTotalsSchema } from "@avenick/contracts";

/**
 * POST /api/v1/checkout/quote — the endpoint that lets a phone show a true
 * total before submit, and therefore the endpoint that must never be allowed
 * to invent a figure.
 *
 * The money in these tests is NOT computed by the test. `composeOrderTotals`,
 * `resolveUnitPrice` and `assertMinimumOrderQuantity` are the real functions
 * from `packages/database/src/services/checkout-invariants.ts`, imported below
 * and handed back through the mocked package barrel; the statutory rates are
 * the real `VAT_RATES` table. What is stubbed is only what needs a database:
 * the catalogue read, the shipping tariff and the promotions engine. So an
 * assertion here that the total is 236.25 is an assertion about the server's
 * own arithmetic, not about a sum this file did independently.
 *
 * Every successful body is parsed through `CheckoutQuoteSchema`, which enforces
 * `vatAmount === goodsVatAmount + shippingVatAmount` at parse time. That is the
 * PR #21 defect encoded as a type: the old total was `goods + goodsVat +
 * shipping`, adding freight AFTER tax, and every figure on the order agreed
 * with every other while the buyer was undercharged.
 */
import {
  assertMinimumOrderQuantity,
  composeOrderTotals,
  resolveUnitPrice,
} from "../../../../../../../../../packages/database/src/services/checkout-invariants";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  findManyProducts: vi.fn(),
  countShippingZones: vi.fn(),
  findUniqueShippingZone: vi.fn(),
  findUniqueCart: vi.fn(),
  quoteShipping: vi.fn(),
  evaluateCommercePromotions: vi.fn(),
  composeOrderTotals: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true, count: 1, limit: 60, resetAt: Date.now() + 60_000 }),
  clientIpFrom: () => "203.0.113.7",
}));
vi.mock("@avenick/observability", () => {
  const log = { error: mocks.logError, info: vi.fn(), warn: vi.fn(), debug: vi.fn(), with: () => log };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});

vi.mock("@avenick/database", async () => {
  const { VAT_RATES } = await import("@avenick/utils");
  const invariants = await import(
    "../../../../../../../../../packages/database/src/services/checkout-invariants"
  );

  class ShippingZoneUnavailableError extends Error {}
  class ShippingZoneAmbiguousError extends Error {}
  class ShippingRateUnavailableError extends Error {}

  return {
    db: {
      user: { findUnique: mocks.findUniqueUser },
      product: { findMany: mocks.findManyProducts },
      shippingZone: { count: mocks.countShippingZones, findUnique: mocks.findUniqueShippingZone },
      cart: { findUnique: mocks.findUniqueCart },
    },
    // The real rules, so tier selection and the MOQ floor are exercised rather
    // than restated.
    resolveUnitPrice: invariants.resolveUnitPrice,
    assertMinimumOrderQuantity: invariants.assertMinimumOrderQuantity,
    // Spied, so the delegation itself can be asserted — and so one test can
    // make it answer with a COLLAPSED vatAmount and prove that never escapes.
    composeOrderTotals: mocks.composeOrderTotals,
    // The order path resolves the jurisdiction from the destination, never the
    // currency, and reads the one statutory table. Mirrored here against the
    // real table so a rate change moves this test with the platform.
    resolveTaxJurisdiction: (address: { country: string } | null, currency: string) => {
      const country = address?.country?.toUpperCase();
      if (!country || !Object.prototype.hasOwnProperty.call(VAT_RATES, country)) {
        throw new Error(`No VAT jurisdiction is configured for "${country ?? currency}"`);
      }
      return { country, rate: VAT_RATES[country]!, source: "SHIPPING_DESTINATION" as const };
    },
    quoteShipping: mocks.quoteShipping,
    evaluateCommercePromotions: mocks.evaluateCommercePromotions,
    ShippingZoneUnavailableError,
    ShippingZoneAmbiguousError,
    ShippingRateUnavailableError,
  };
});

import { ShippingZoneAmbiguousError, ShippingZoneUnavailableError } from "@avenick/database";

import { POST } from "../route";

const KETTLE = {
  id: "prod_kettle",
  sellerId: "sel_1",
  categoryId: "cat_1",
  brandId: null,
  status: "ACTIVE",
  sku: "SKU-KETTLE",
  nameEn: "Steel Kettle",
  nameAr: "غلاية فولاذية",
  moq: 1,
  weight: 2,
  isB2CEnabled: true,
  isB2BEnabled: true,
  seller: { status: "ACTIVE", deletedAt: null },
  prices: [
    { id: "pr_1", type: "B2C", currency: "AED", minQty: 1, maxQty: 9, price: 100, isActive: true, vatRate: 5 },
    // A second band, so tier selection is a real decision and not a single row.
    { id: "pr_2", type: "B2C", currency: "AED", minQty: 10, maxQty: null, price: 90, isActive: true, vatRate: 5 },
    // A second currency, so the selector's currency filter is a real decision too.
    { id: "pr_3", type: "B2C", currency: "QAR", minQty: 1, maxQty: null, price: 100, isActive: true, vatRate: 0 },
  ],
  variants: [],
};

function quoteRequest(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ productId: "prod_kettle", quantity: 2 }],
    shippingAddress: { label: "Home", line1: "12 Marina Street", city: "Dubai", country: "AE" },
    currency: "AED",
    channel: "B2C",
    ...overrides,
  };
}

function call(body: unknown) {
  return POST(
    new NextRequest("https://customer.test/api/v1/checkout/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function quoteOf(response: Response) {
  const body = (await response.json()) as { data: unknown };
  // Parsing through the contract is the assertion: a collapsed vatAmount or a
  // total that does not reconcile fails HERE.
  return CheckoutQuoteSchema.parse(body.data);
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

function signedInConsumer() {
  mocks.auth.mockResolvedValue({ user: { id: "usr_1" } });
  mocks.findUniqueUser.mockResolvedValue({
    role: "CONSUMER",
    status: "ACTIVE",
    deletedAt: null,
    companyMember: null,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.composeOrderTotals.mockImplementation(composeOrderTotals);
  mocks.auth.mockResolvedValue(null);
  mocks.findManyProducts.mockResolvedValue([KETTLE]);
  mocks.countShippingZones.mockResolvedValue(1);
  mocks.findUniqueShippingZone.mockResolvedValue({ nameEn: "Gulf domestic" });
  mocks.quoteShipping.mockResolvedValue({
    zoneId: "zone_1",
    zoneCode: "GCC_DOMESTIC",
    price: 25,
    currency: "AED",
    basis: "WEIGHT_BAND",
    billableWeightKg: 4,
    etaMinDays: 2,
    etaMaxDays: 4,
  });
  mocks.evaluateCommercePromotions.mockResolvedValue({
    discountAmount: 0,
    lineDiscounts: {},
    applied: [],
    explanation: [],
  });
});

describe("a guest asking what a basket costs", () => {
  it("is answered, because a total is what makes a buyer sign in", async () => {
    const response = await call(quoteRequest());
    expect(response.status).toBe(200);
    const quote = await quoteOf(response);
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0]).toMatchObject({
      productId: "prod_kettle",
      sku: "SKU-KETTLE",
      quantity: 2,
      unitPrice: 100,
      vatRatePercent: 5,
    });
    expect(quote.promotions).toEqual([]);
  });

  it("TAXES THE DELIVERY, which is the defect PR #21 fixed", async () => {
    const { totals } = await quoteOf(await call(quoteRequest()));
    // 200 goods + 10 goods VAT + 25 freight + 1.25 freight VAT.
    expect(totals).toEqual({
      subtotal: 200,
      discountAmount: 0,
      goodsVatAmount: 10,
      shippingAmount: 25,
      shippingVatAmount: 1.25,
      vatAmount: 11.25,
      total: 236.25,
    });
    // The old arithmetic — goods + goodsVat + shipping — produced 235 and
    // declared 10 in tax. Both are wrong by the freight's VAT, and both scale
    // with the freight bill.
    expect(totals.total).not.toBe(235);
    expect(totals.vatAmount).not.toBe(totals.goodsVatAmount);
  });

  it("declares tax as BOTH components, never only the goods", async () => {
    const { totals } = await quoteOf(await call(quoteRequest()));
    expect(totals.vatAmount).toBe(
      Number((totals.goodsVatAmount + totals.shippingVatAmount).toFixed(2)),
    );
    expect(totals.shippingVatAmount).toBeGreaterThan(0);
  });

  it("delegates the whole assembly to composeOrderTotals", async () => {
    await call(quoteRequest());
    expect(mocks.composeOrderTotals).toHaveBeenCalledTimes(1);
    expect(mocks.composeOrderTotals).toHaveBeenCalledWith({
      subtotal: 200,
      discountAmount: 0,
      goodsVatAmount: 10,
      shippingAmount: 25,
      vatRatePercent: 5,
    });
  });

  it("resolves the quantity's price band rather than the first row", async () => {
    const quote = await quoteOf(await call(quoteRequest({
      items: [{ productId: "prod_kettle", quantity: 10 }],
    })));
    expect(quote.lines[0]!.unitPrice).toBe(90);
    expect(quote.totals.subtotal).toBe(900);
  });

  it("prices the destination's jurisdiction, not the currency's", async () => {
    const quote = await quoteOf(await call(quoteRequest({
      shippingAddress: { label: "Office", line1: "King Fahd Road", city: "Riyadh", country: "SA" },
    })));
    // SA is 15%: 30 on the goods and 3.75 on the delivery.
    expect(quote.vatRatePercent).toBe(15);
    expect(quote.totals).toMatchObject({
      goodsVatAmount: 30,
      shippingVatAmount: 3.75,
      vatAmount: 33.75,
      total: 258.75,
    });
  });

  it("states a zero rate rather than omitting the field", async () => {
    // QA carries rate 0. A missing shippingVatAmount and a zero one are
    // different claims, and the contract keeps the difference.
    const quote = await quoteOf(await call(quoteRequest({
      shippingAddress: { label: "Home", line1: "Al Sadd", city: "Doha", country: "QA" },
      currency: "QAR",
    })));
    expect(quote.totals.shippingVatAmount).toBe(0);
    expect(quote.totals.vatAmount).toBe(0);
    expect(quote.totals.total).toBe(225);
  });

  it("is told to sign in before a coupon is honoured", async () => {
    // Per-customer redemption limits cannot be counted without an identity, and
    // a sentinel id counts zero for everybody — which hands every guest a
    // one-per-customer promotion, on every request.
    const response = await call(quoteRequest({ couponCode: "WELCOME10" }));
    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe("unauthenticated");
    expect(mocks.evaluateCommercePromotions).not.toHaveBeenCalled();
  });

  it("is told to sign in before business pricing is quoted", async () => {
    const response = await call(quoteRequest({ channel: "B2B" }));
    expect(response.status).toBe(401);
    expect(mocks.findManyProducts).not.toHaveBeenCalled();
  });
});

describe("how delivery is reported", () => {
  it("says a zone priced it, and names the zone the buyer can read", async () => {
    const quote = await quoteOf(await call(quoteRequest()));
    expect(quote.shipping).toEqual({
      status: "priced",
      zoneName: "Gulf domestic",
      amount: 25,
      vatRatePercent: 5,
      estimatedDaysMin: 2,
      estimatedDaysMax: 4,
    });
  });

  it("distinguishes 'nobody has configured delivery' from 'we do not ship there'", async () => {
    mocks.countShippingZones.mockResolvedValue(0);
    const quote = await quoteOf(await call(quoteRequest()));
    // No zones anywhere: freight is genuinely zero and the order will proceed,
    // which is how checkout behaved before shipping zones existed.
    expect(quote.shipping.status).toBe("unpriced_no_zones");
    expect(quote.totals.total).toBe(210);
    expect(mocks.quoteShipping).not.toHaveBeenCalled();
  });

  it("says unavailable when zones exist and none covers the destination", async () => {
    // The order WILL be refused. An app that could not tell this from the case
    // above would show a free-delivery badge on an order about to be rejected.
    mocks.quoteShipping.mockRejectedValue(new ShippingZoneUnavailableError("AE"));
    const quote = await quoteOf(await call(quoteRequest()));
    expect(quote.shipping.status).toBe("unavailable");
    expect(quote.shipping.amount).toBe(0);
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it("tells the buyer the truth and an operator the reason when a tariff is ambiguous", async () => {
    mocks.quoteShipping.mockRejectedValue(new ShippingZoneAmbiguousError("AE", ["GCC_DOMESTIC", "GULF_EXPRESS"]));
    const quote = await quoteOf(await call(quoteRequest()));
    expect(quote.shipping.status).toBe("unavailable");
    // Not the buyer's fault and not this request's fault — but somebody has to
    // be told, because only an operator can fix it.
    expect(mocks.logError).toHaveBeenCalledTimes(1);
  });

  it("quotes freight against the pre-discount subtotal the free-delivery threshold reads", async () => {
    signedInConsumer();
    mocks.evaluateCommercePromotions.mockResolvedValue({
      discountAmount: 20,
      lineDiscounts: { "line-0": 20 },
      applied: [],
      explanation: [],
    });
    await call(quoteRequest());
    expect(mocks.quoteShipping).toHaveBeenCalledWith(
      expect.objectContaining({ country: "AE", currency: "AED", subtotal: 200 }),
    );
  });
});

describe("a signed-in buyer", () => {
  it("has promotions applied, and sees them named on the quote", async () => {
    signedInConsumer();
    mocks.evaluateCommercePromotions.mockResolvedValue({
      discountAmount: 20,
      lineDiscounts: { "line-0": 20 },
      applied: [
        { promotionId: "promo_1", name: "Autumn 10%", source: "COUPON", couponCode: "AUTUMN", discount: 20 },
      ],
      explanation: [],
    });
    const quote = await quoteOf(await call(quoteRequest({ couponCode: "AUTUMN" })));
    expect(quote.promotions).toEqual([
      { promotionId: "promo_1", couponCode: "AUTUMN", label: "Autumn 10%", discountAmount: 20 },
    ]);
    // VAT follows the discount: 5% of 180, not of 200.
    expect(quote.totals).toMatchObject({
      subtotal: 200,
      discountAmount: 20,
      goodsVatAmount: 9,
      shippingVatAmount: 1.25,
      vatAmount: 10.25,
      total: 215.25,
    });
  });

  it("hands the promotions engine the scope fields a targeted rule needs", async () => {
    signedInConsumer();
    await call(quoteRequest());
    expect(mocks.evaluateCommercePromotions).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usr_1",
        currency: "AED",
        country: "AE",
        lines: [
          expect.objectContaining({
            key: "line-0",
            productId: "prod_kettle",
            categoryId: "cat_1",
            sellerId: "sel_1",
            quantity: 2,
            baseUnitPrice: 100,
          }),
        ],
      }),
    );
  });

  it("is told which coupon failed, as a field error rather than a fault", async () => {
    signedInConsumer();
    mocks.evaluateCommercePromotions.mockRejectedValue(new Error("Coupon usage limit has been reached"));
    const response = await call(quoteRequest({ couponCode: "AUTUMN" }));
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe("validation_failed");
    expect(error.fieldErrors?.couponCode?.[0]).toMatch(/usage limit/i);
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it("is refused a quote for a basket the server no longer holds", async () => {
    signedInConsumer();
    mocks.findUniqueCart.mockResolvedValue({
      userId: "usr_1",
      items: [{ productId: "prod_kettle", variantId: null, qty: 5 }],
    });
    const response = await call(quoteRequest({ cartId: "cart_1" }));
    expect(response.status).toBe(409);
    expect((await errorOf(response)).code).toBe("conflict");
    expect(mocks.findManyProducts).not.toHaveBeenCalled();
  });

  it("is quoted when the cart agrees with what the screen shows", async () => {
    signedInConsumer();
    mocks.findUniqueCart.mockResolvedValue({
      userId: "usr_1",
      items: [{ productId: "prod_kettle", variantId: null, qty: 2 }],
    });
    const response = await call(quoteRequest({ cartId: "cart_1" }));
    expect(response.status).toBe(200);
  });

  it("cannot probe for other accounts' cart ids", async () => {
    signedInConsumer();
    mocks.findUniqueCart.mockResolvedValue({ userId: "usr_someone_else", items: [] });
    const response = await call(quoteRequest({ cartId: "cart_2" }));
    expect(response.status).toBe(404);
  });
});

describe("what the quote refuses", () => {
  it("reports a malformed request as validation_failed with the field path", async () => {
    const response = await call(quoteRequest({ currency: undefined }));
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe("validation_failed");
    expect(error.fieldErrors?.currency).toBeDefined();
  });

  it("refuses a client-supplied money field outright", async () => {
    // A shipping figure the client can influence is a discount the client can
    // grant itself, so the request schema is .strict() and the extra key is a
    // refusal rather than a silently ignored field.
    const response = await call(quoteRequest({ shippingAmount: 0 }));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors).toBeDefined();
  });

  it("answers 404 for a line whose product is gone", async () => {
    mocks.findManyProducts.mockResolvedValue([]);
    const response = await call(quoteRequest());
    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe("not_found");
  });

  it("answers 409 for a product that is no longer sellable", async () => {
    mocks.findManyProducts.mockResolvedValue([{ ...KETTLE, status: "SUPPRESSED" }]);
    const response = await call(quoteRequest());
    expect(response.status).toBe(409);
    expect((await errorOf(response)).code).toBe("conflict");
  });

  it("names the line when a quantity is below the seller's minimum", async () => {
    mocks.findManyProducts.mockResolvedValue([{ ...KETTLE, moq: 12 }]);
    const response = await call(quoteRequest());
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.["items.0.quantity"]?.[0]).toMatch(/12/);
  });

  it("asks for a variant rather than quoting one at random", async () => {
    mocks.findManyProducts.mockResolvedValue([{
      ...KETTLE,
      variants: [{ id: "var_1", sku: "SKU-K-RED", nameEn: "Red", nameAr: null, isActive: true, prices: [] }],
    }]);
    const response = await call(quoteRequest());
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.["items.0.variantId"]).toBeDefined();
  });

  it("NEVER lets a collapsed vatAmount reach the client", async () => {
    // The scenario the contract exists to make impossible: something upstream
    // declares only the goods VAT as the order's tax. The response must not go
    // out at all — under-declared tax on a phone is a silent wrong answer that
    // is persisted downstream by invoicing and settlement.
    mocks.composeOrderTotals.mockImplementation((input: Parameters<typeof composeOrderTotals>[0]) => {
      const honest = composeOrderTotals(input);
      return { ...honest, vatAmount: honest.goodsVatAmount };
    });
    const response = await call(quoteRequest());
    expect(response.status).toBe(500);
    expect((await errorOf(response)).code).toBe("internal");
    expect(mocks.logError).toHaveBeenCalledWith(
      "v1 response violates its contract",
      expect.anything(),
      expect.objectContaining({ route: "/api/v1/checkout/quote" }),
    );
  });

  it("rejects a collapsed vatAmount at the contract itself", async () => {
    // Belt and braces, stated as the schema's own behaviour: the guard above
    // only works because OrderTotalsSchema refuses this payload.
    const collapsed = {
      subtotal: 200,
      discountAmount: 0,
      goodsVatAmount: 10,
      shippingAmount: 25,
      shippingVatAmount: 1.25,
      vatAmount: 10,
      total: 236.25,
    };
    const outcome = OrderTotalsSchema.safeParse(collapsed);
    expect(outcome.success).toBe(false);
    expect(outcome.error?.issues.some((issue) => issue.path.includes("vatAmount"))).toBe(true);
  });
});

describe("the rules the quote shares with the order", () => {
  it("uses the same tier selector the order transaction uses", () => {
    // Imported from checkout-invariants, not re-derived here: highest matching
    // minQty wins, which is what makes a tiered price a tier.
    expect(resolveUnitPrice(KETTLE.prices, "B2C", "AED", 10)?.id).toBe("pr_2");
    expect(resolveUnitPrice(KETTLE.prices, "B2C", "AED", 9)?.id).toBe("pr_1");
    expect(resolveUnitPrice(KETTLE.prices, "B2B", "AED", 10)).toBeNull();
  });

  it("uses the same minimum-quantity rule the order transaction uses", () => {
    expect(() => assertMinimumOrderQuantity("Steel Kettle", 1, 12)).toThrow(/Minimum order quantity/);
    expect(() => assertMinimumOrderQuantity("Steel Kettle", 12, 12)).not.toThrow();
  });
});
