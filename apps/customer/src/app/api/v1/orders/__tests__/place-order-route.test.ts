import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorEnvelopeSchema, PlaceOrderResponseSchema } from "@avenick/contracts";

/**
 * POST /api/v1/orders — the write the app could not previously make at all.
 *
 * Two properties dominate this file and neither is a happy path:
 *
 *  1. THE PAYMENT GATE FAILS CLOSED. A signed Checkout.com webhook exists in
 *     this repository; a flow that CREATES a payment session does not. An order
 *     placed with a card would be accepted, recorded UNPAID and never
 *     chargeable — a buyer who believes they paid and an operator with an order
 *     nobody can settle. Every card and wallet method is asserted individually,
 *     because a gate that covers three of four is not a gate.
 *
 *  2. A RETRY IS NOT A SECOND ORDER. The fingerprint is computed by the REAL
 *     `canonicalOrderRequest` — the module is pure, so it is imported rather
 *     than stubbed — which means the replay tests exercise the actual hash the
 *     server stores, not a stand-in that agrees with itself.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  findUniqueOrder: vi.fn(),
  findFirstOrder: vi.fn(),
  secureCreateOrder: vi.fn(),
  finalizeInternalOrderPayment: vi.fn(),
  checkRateLimit: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIpFrom: () => "203.0.113.7",
  // The SHARED table, mirrored: this endpoint must draw on the same budget as
  // the web checkout, not on a v1-local one.
  RATE_LIMITS: { orderCreate: { name: "order-create", limit: 30, windowMs: 60_000 } },
}));
vi.mock("@avenick/observability", () => {
  const log = { error: mocks.logError, info: vi.fn(), warn: vi.fn(), debug: vi.fn(), with: () => log };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});
vi.mock("@avenick/database", () => ({
  db: {
    user: { findUnique: mocks.findUniqueUser },
    order: { findUnique: mocks.findUniqueOrder, findFirst: mocks.findFirstOrder },
  },
  secureCreateOrder: mocks.secureCreateOrder,
  finalizeInternalOrderPayment: mocks.finalizeInternalOrderPayment,
  // The real rule, restated: generic checkout must never consume a governed PO.
  assertGenericCheckoutHasNoPurchaseOrder: (purchaseOrderId?: string) => {
    if (purchaseOrderId) {
      throw new Error("Purchase orders must be placed through the governed purchase-order workflow");
    }
  },
}));

import { POST } from "../route";

const dec = (value: string) => ({ toString: () => value });

const DETAIL_ROW = {
  id: "ord_new",
  orderNumber: "AV-0002",
  status: "PENDING_PAYMENT",
  paymentStatus: "UNPAID",
  paymentMethod: "BANK_TRANSFER",
  type: "B2C",
  currency: "AED",
  subtotal: dec("200.00"),
  discountAmount: dec("0.00"),
  shippingAmount: dec("25.00"),
  vatAmount: dec("11.25"),
  goodsVatAmount: null,
  shippingVatAmount: null,
  total: dec("236.25"),
  shippingAddress: { label: "Home", line1: "12 Marina Street", city: "Dubai", country: "AE" },
  notes: null,
  vatInvoiceUrl: null,
  createdAt: new Date("2026-03-01T09:00:00.000Z"),
  updatedAt: new Date("2026-03-01T09:00:00.000Z"),
  items: [
    {
      id: "oi_1",
      productId: "prod_1",
      variantId: null,
      sellerId: "sel_1",
      sku: "SKU-1",
      nameEn: "Safety Helmet",
      nameAr: "خوذة أمان",
      quantity: 2,
      unitPrice: dec("100.00"),
      vatRate: dec("5.00"),
      vatAmount: dec("10.00"),
      total: dec("200.00"),
      status: "PENDING_PAYMENT",
      product: { slug: "safety-helmet", images: [] },
    },
  ],
  shipments: [],
  statusHistory: [
    { status: "PENDING_PAYMENT", message: "Order created, awaiting payment", createdAt: new Date("2026-03-01T09:00:00.000Z") },
  ],
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ productId: "prod_1", quantity: 2 }],
    shippingAddress: { label: "Home", line1: "12 Marina Street", city: "Dubai", country: "AE" },
    paymentMethod: "BANK_TRANSFER",
    currency: "AED",
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://customer.test/api/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

function signedInBuyer(role = "CONSUMER") {
  mocks.auth.mockResolvedValue({ user: { id: "usr_1" } });
  mocks.findUniqueUser.mockResolvedValue({ role, status: "ACTIVE", deletedAt: null, companyMember: null });
}

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.PILOT_MODE;
  delete process.env.ALLOW_MOCK_PAYMENTS;
  mocks.auth.mockResolvedValue(null);
  mocks.checkRateLimit.mockResolvedValue({ ok: true, count: 1, limit: 30, resetAt: Date.now() + 60_000 });
  mocks.findUniqueOrder.mockResolvedValue(null);
  mocks.findFirstOrder.mockResolvedValue(DETAIL_ROW);
  mocks.secureCreateOrder.mockResolvedValue({ id: "ord_new", paymentMethod: "BANK_TRANSFER" });
  mocks.finalizeInternalOrderPayment.mockResolvedValue({ replay: false });
});

describe("who may place an order", () => {
  it("refuses a guest before reading anything", async () => {
    const response = await POST(post(order()));
    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe("unauthenticated");
    expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
  });

  it("refuses a seller account, which the checkout transaction would refuse anyway", async () => {
    // Finding out before the buyer fills in a form is the point.
    signedInBuyer("SELLER_OWNER");
    const response = await POST(post(order()));
    expect(response.status).toBe(403);
    expect((await errorOf(response)).code).toBe("forbidden");
    expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
  });

  it("draws on the SHARED order-create budget, not a v1-local one", async () => {
    signedInBuyer();
    await POST(post(order()));
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "order-create" }),
      "usr_1",
    );
  });

  it("answers 429 with a Retry-After when the budget is spent", async () => {
    signedInBuyer();
    mocks.checkRateLimit.mockResolvedValue({ ok: false, count: 31, limit: 30, resetAt: Date.now() + 30_000 });
    const response = await POST(post(order()));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
  });
});

describe("THE PAYMENT GATE — fails closed, and must stay closed", () => {
  beforeEach(() => signedInBuyer());

  it.each(["MADA", "APPLE_PAY", "CREDIT_CARD", "STC_PAY"])(
    "refuses %s with 503, and creates NO order",
    async (paymentMethod) => {
      // There is no payment-session flow in this deployment. An order accepted
      // here is recorded UNPAID and can never be charged.
      const response = await POST(post(order({ paymentMethod })));
      expect(response.status).toBe(503);
      expect((await errorOf(response)).code).toBe("upstream_unavailable");
      expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
      expect(mocks.finalizeInternalOrderPayment).not.toHaveBeenCalled();
    },
  );

  it("chooses upstream_unavailable over payment_required, and says why in the status", async () => {
    // 402 means "go and pay" — advice this client cannot act on, because there
    // is no session to enter. 503 says the provider is not reachable from this
    // platform, which is true, and is the status /api/orders already answers.
    const response = await POST(post(order({ paymentMethod: "CREDIT_CARD" })));
    expect(response.status).toBe(503);
    expect((await errorOf(response)).code).not.toBe("payment_required");
    // And it IS logged. The wrapper logs every 5xx, which is right here: a
    // buyer reaching a card gate on a deployment that cannot take cards is a
    // configuration fact an operator should see, not routine traffic.
    expect(mocks.logError).toHaveBeenCalledWith(
      "v1 route error",
      expect.anything(),
      expect.objectContaining({ route: "/api/v1/orders", code: "upstream_unavailable" }),
    );
  });

  it("refuses a test payment outside a pilot deployment", async () => {
    const response = await POST(post(order({ paymentMethod: "MOCK" })));
    expect(response.status).toBe(409);
    expect((await errorOf(response)).code).toBe("conflict");
    expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
  });

  it("allows a test payment only when BOTH pilot switches are on", async () => {
    process.env.PILOT_MODE = "true";
    process.env.ALLOW_MOCK_PAYMENTS = "true";
    mocks.secureCreateOrder.mockResolvedValue({ id: "ord_new", paymentMethod: "MOCK" });
    mocks.findFirstOrder.mockResolvedValue({ ...DETAIL_ROW, paymentMethod: "MOCK", paymentStatus: "PAID" });

    const response = await POST(post(order({ paymentMethod: "MOCK" })));
    expect(response.status).toBe(200);
    expect(mocks.finalizeInternalOrderPayment).toHaveBeenCalledWith(
      expect.objectContaining({ method: "MOCK", pilotMockAllowed: true, actorId: "usr_1" }),
    );
  });

  it("still refuses a test payment when only one switch is on", async () => {
    process.env.PILOT_MODE = "true";
    const response = await POST(post(order({ paymentMethod: "MOCK" })));
    expect(response.status).toBe(409);
  });
});

describe("placing the order", () => {
  beforeEach(() => signedInBuyer());

  it("answers the whole order, through the same projection the order screen uses", async () => {
    const response = await POST(post(order()));
    expect(response.status).toBe(200);
    const { data } = PlaceOrderResponseSchema.parse(await response.json());
    expect(data.replayed).toBe(false);
    expect(data.order).toMatchObject({
      id: "ord_new",
      orderNumber: "AV-0002",
      currency: "AED",
      totals: { subtotal: 200, vatAmount: 11.25, total: 236.25, goodsVatAmount: null, shippingVatAmount: null },
    });
    expect(data.order.items).toHaveLength(1);
  });

  it("sends the transaction identity and quantity, and no money", async () => {
    await POST(post(order({ couponCode: "AUTUMN10", notes: "Gate 4" })));
    const [call] = mocks.secureCreateOrder.mock.calls[0]!;
    expect(call).toMatchObject({
      userId: "usr_1",
      type: "B2C",
      currency: "AED",
      items: [{ productId: "prod_1", quantity: 2 }],
      paymentMethod: "BANK_TRANSFER",
      couponCode: "AUTUMN10",
      notes: "Gate 4",
    });
    // A shipping figure the client can influence is a discount it grants itself.
    expect(Object.keys(call)).not.toContain("shippingAmount");
    expect(Object.keys(call)).not.toContain("unitPrice");
  });

  it("settles the transfer BEFORE reading the order back", async () => {
    // /api/orders answers from the pre-settlement row and is one refresh behind.
    await POST(post(order()));
    expect(mocks.finalizeInternalOrderPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "ord_new", method: "BANK_TRANSFER", actorId: "usr_1" }),
    );
    expect(mocks.finalizeInternalOrderPayment.mock.invocationCallOrder[0]!)
      .toBeLessThan(mocks.findFirstOrder.mock.invocationCallOrder[0]!);
  });

  it("scopes the read back to the placing account", async () => {
    await POST(post(order()));
    expect(mocks.findFirstOrder.mock.calls[0]![0].where).toEqual({ id: "ord_new", userId: "usr_1" });
  });

  it("reports a stale basket as a conflict, with the reason", async () => {
    mocks.secureCreateOrder.mockRejectedValue(new Error('Insufficient stock for "Safety Helmet"'));
    const response = await POST(post(order()));
    expect(response.status).toBe(409);
    const error = await errorOf(response);
    expect(error.code).toBe("conflict");
    expect(error.message).toMatch(/stock/i);
    // The endpoint working, not a fault. Nobody is paged for a sold-out item.
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it("reports an UNEXPECTED fault as internal, and tells the client nothing else", async () => {
    mocks.secureCreateOrder.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.4:5432"));
    const response = await POST(post(order()));
    expect(response.status).toBe(500);
    const error = await errorOf(response);
    expect(error.code).toBe("internal");
    // A message assembled from an unexpected fault is how a connection string
    // reaches a phone.
    expect(error.message).not.toMatch(/ECONNREFUSED|5432/);
    expect(mocks.logError).toHaveBeenCalled();
  });
});

describe("a retry is not a second order", () => {
  beforeEach(() => signedInBuyer());

  it("replays the original order instead of creating another", async () => {
    // First submission.
    await POST(post(order(), { "idempotency-key": "key-1" }));
    const storedFingerprint = mocks.secureCreateOrder.mock.calls[0]![0].requestFingerprint;
    expect(typeof storedFingerprint).toBe("string");
    mocks.secureCreateOrder.mockClear();

    // The retry the phone on a warehouse connection actually sends.
    mocks.findUniqueOrder.mockResolvedValue({
      id: "ord_new",
      paymentMethod: "BANK_TRANSFER",
      requestFingerprint: storedFingerprint,
    });
    const response = await POST(post(order(), { "idempotency-key": "key-1" }));

    expect(response.status).toBe(200);
    const { data } = PlaceOrderResponseSchema.parse(await response.json());
    expect(data.replayed).toBe(true);
    expect(data.order.id).toBe("ord_new");
    expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
  });

  it("repairs a settlement the first attempt died before reaching", async () => {
    mocks.findUniqueOrder.mockResolvedValue({
      id: "ord_new",
      paymentMethod: "BANK_TRANSFER",
      requestFingerprint: "whatever",
    });
    // The stored fingerprint has to match for the replay to be served, so drive
    // it from the real canonicaliser by placing the same body first.
    mocks.findUniqueOrder.mockResolvedValueOnce(null);
    await POST(post(order(), { "idempotency-key": "key-2" }));
    const fingerprint = mocks.secureCreateOrder.mock.calls[0]![0].requestFingerprint;
    mocks.finalizeInternalOrderPayment.mockClear();

    mocks.findUniqueOrder.mockResolvedValue({
      id: "ord_new",
      paymentMethod: "BANK_TRANSFER",
      requestFingerprint: fingerprint,
    });
    await POST(post(order(), { "idempotency-key": "key-2" }));
    expect(mocks.finalizeInternalOrderPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "ord_new", method: "BANK_TRANSFER" }),
    );
  });

  it("REFUSES the same key for a different order", async () => {
    // Otherwise the client is handed an order for goods this request never
    // asked for. The fingerprint is computed by the real canonicaliser.
    mocks.findUniqueOrder.mockResolvedValue({
      id: "ord_other",
      paymentMethod: "BANK_TRANSFER",
      requestFingerprint: "a-fingerprint-for-an-entirely-different-basket",
    });
    const response = await POST(post(order(), { "idempotency-key": "key-3" }));
    expect(response.status).toBe(409);
    expect((await errorOf(response)).message).toMatch(/idempotency/i);
    expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
  });

  it("notices a basket that differs only in quantity", async () => {
    mocks.findUniqueOrder.mockResolvedValueOnce(null);
    await POST(post(order(), { "idempotency-key": "key-4" }));
    const fingerprint = mocks.secureCreateOrder.mock.calls[0]![0].requestFingerprint;

    mocks.findUniqueOrder.mockResolvedValue({ id: "ord_new", paymentMethod: "BANK_TRANSFER", requestFingerprint: fingerprint });
    const changed = await POST(post(order({ items: [{ productId: "prod_1", quantity: 3 }] }), {
      "idempotency-key": "key-4",
    }));
    expect(changed.status).toBe(409);
  });

  it("refuses an oversized key, naming the header", async () => {
    const response = await POST(post(order(), { "idempotency-key": "k".repeat(129) }));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.["Idempotency-Key"]).toBeDefined();
    expect(mocks.findUniqueOrder).not.toHaveBeenCalled();
  });

  it("places without a key, because the header is optional", async () => {
    const response = await POST(post(order()));
    expect(response.status).toBe(200);
    expect(mocks.findUniqueOrder).not.toHaveBeenCalled();
    expect(mocks.secureCreateOrder.mock.calls[0]![0].idempotencyKey).toBeUndefined();
  });
});

describe("what the request refuses to carry", () => {
  beforeEach(() => signedInBuyer());

  it("has no B2B door: `type` is not a field, so sending it is a 400 not a 409", async () => {
    // assertGovernedB2BCheckout refuses generic B2B checkout unconditionally, so
    // a `type` field would be a switch with one working position. A validation
    // failure says "this surface does not do that"; a conflict would say "try
    // again differently" when there is no differently.
    const response = await POST(post(order({ type: "B2B" })));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe("validation_failed");
    expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
  });

  it("has no purchaseOrderId either", async () => {
    const response = await POST(post(order({ purchaseOrderId: "po_1" })));
    expect(response.status).toBe(400);
    expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
  });

  it("refuses a client-supplied money field outright", async () => {
    const response = await POST(post(order({ shippingAmount: 0, total: 1 })));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors).toBeDefined();
  });

  it("names the field when the currency is missing", async () => {
    const { currency: _dropped, ...withoutCurrency } = order();
    const response = await POST(post(withoutCurrency));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.currency).toBeDefined();
  });

  it("refuses an empty basket at the schema, before any transaction", async () => {
    const response = await POST(post(order({ items: [] })));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.items).toBeDefined();
    expect(mocks.secureCreateOrder).not.toHaveBeenCalled();
  });
});
