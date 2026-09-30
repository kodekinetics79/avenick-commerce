import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ErrorEnvelopeSchema,
  OrderDetailResponseSchema,
  OrderListResponseSchema,
  PersistedOrderTotalsSchema,
} from "@avenick/contracts";

/**
 * GET /api/v1/orders and /api/v1/orders/{id}.
 *
 * Two properties are load-bearing here and both are tested as properties
 * rather than as happy paths:
 *
 *  1. OWNER SCOPING. `userId` is part of the `where`, so another account's
 *     order is never read — not read-then-rejected. The test asserts BOTH that
 *     the answer is 404 and that the predicate carried the caller's id, because
 *     a version that filtered after reading would pass the first assertion.
 *
 *  2. THE VAT SPLIT. `Order.goodsVatAmount` / `shippingVatAmount` exist as
 *     nullable columns and NOTHING WRITES THEM — `services/orders.ts` still
 *     drops the two components on the floor. Null is the honest answer, and a
 *     derived one (`goodsVatAmount = vatAmount`) would be wrong by exactly the
 *     freight's VAT, which is the defect PR #21 fixed.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  findManyOrders: vi.fn(),
  findFirstOrder: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true, count: 1, limit: 120, resetAt: Date.now() + 60_000 }),
  clientIpFrom: () => "203.0.113.7",
  // The route module also declares POST, which draws on the SHARED order-create
  // budget rather than a v1-local rule.
  RATE_LIMITS: { orderCreate: { name: "order-create", limit: 30, windowMs: 60_000 } },
}));
vi.mock("@avenick/observability", () => {
  const log = { error: mocks.logError, info: vi.fn(), warn: vi.fn(), debug: vi.fn(), with: () => log };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});
vi.mock("@avenick/database", () => ({
  db: {
    user: { findUnique: mocks.findUniqueUser },
    order: { findMany: mocks.findManyOrders, findFirst: mocks.findFirstOrder, findUnique: vi.fn() },
  },
  // Imported by the POST handler that shares this route module. Reading orders
  // never reaches them.
  secureCreateOrder: vi.fn(),
  finalizeInternalOrderPayment: vi.fn(),
  assertGenericCheckoutHasNoPurchaseOrder: () => {},
}));

import { GET as GET_DETAIL } from "../[id]/route";
import { GET as GET_LIST } from "../route";

const dec = (value: string) => ({ toString: () => value });

function cardRow(id: string, createdAt: string) {
  return {
    id,
    orderNumber: `AV-${id.toUpperCase()}`,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    type: "B2C",
    currency: "AED",
    total: dec("236.25"),
    createdAt: new Date(createdAt),
    _count: { items: 3 },
    items: [
      { product: { images: [] } },
      { product: { images: [{ url: "https://placehold.co/600x600/x", altEn: "Helmet" }] } },
    ],
  };
}

const DETAIL_ROW = {
  id: "ord_1",
  orderNumber: "AV-0001",
  status: "SHIPPED",
  paymentStatus: "PAID",
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
  updatedAt: new Date("2026-03-02T09:00:00.000Z"),
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
      status: "SHIPPED",
      product: {
        slug: "safety-helmet",
        images: [{ url: "https://placehold.co/600x600/x", altEn: "Helmet" }],
      },
    },
  ],
  shipments: [
    {
      id: "shp_1",
      status: "IN_TRANSIT",
      carrier: "Aramex",
      trackingNumber: "TRK-9",
      promisedBy: new Date("2026-03-05T00:00:00.000Z"),
    },
  ],
  statusHistory: [
    { status: "SHIPPED", message: "Handed to the carrier", createdAt: new Date("2026-03-02T09:00:00.000Z") },
    { status: "CONFIRMED", message: "Payment received", createdAt: new Date("2026-03-01T09:05:00.000Z") },
  ],
};

function get(path: string) {
  return new NextRequest(`https://customer.test${path}`, { method: "GET" });
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

function signedInAs(userId: string) {
  mocks.auth.mockResolvedValue({ user: { id: userId } });
  mocks.findUniqueUser.mockResolvedValue({
    role: "CONSUMER",
    status: "ACTIVE",
    deletedAt: null,
    companyMember: null,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.findManyOrders.mockResolvedValue([cardRow("a", "2026-03-03T00:00:00.000Z")]);
  mocks.findFirstOrder.mockResolvedValue(DETAIL_ROW);
});

describe("who may read an order", () => {
  it("refuses a guest the list", async () => {
    const response = await GET_LIST(get("/api/v1/orders"));
    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe("unauthenticated");
    expect(mocks.findManyOrders).not.toHaveBeenCalled();
  });

  it("refuses a guest one order", async () => {
    const response = await GET_DETAIL(get("/api/v1/orders/ord_1"), { params: { id: "ord_1" } });
    expect(response.status).toBe(401);
    expect(mocks.findFirstOrder).not.toHaveBeenCalled();
  });

  it("refuses a session naming a suspended account, rather than serving it as a guest", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "usr_1" } });
    mocks.findUniqueUser.mockResolvedValue({
      role: "CONSUMER", status: "SUSPENDED", deletedAt: null, companyMember: null,
    });
    const response = await GET_LIST(get("/api/v1/orders"));
    expect(response.status).toBe(403);
    expect((await errorOf(response)).code).toBe("forbidden");
  });

  it("scopes the LIST by the caller's id in the predicate, not after the read", async () => {
    signedInAs("usr_a");
    await GET_LIST(get("/api/v1/orders"));
    expect(mocks.findManyOrders.mock.calls[0]![0].where).toMatchObject({ userId: "usr_a" });
  });

  /**
   * THE SECURITY PROPERTY. User A asks for user B's order.
   */
  it("does not let one account read another's order", async () => {
    signedInAs("usr_a");
    // The database answers with nothing, because the query asked for an order
    // that is BOTH this id and this user's.
    mocks.findFirstOrder.mockResolvedValue(null);

    const response = await GET_DETAIL(get("/api/v1/orders/ord_belonging_to_b"), {
      params: { id: "ord_belonging_to_b" },
    });

    expect(response.status).toBe(404);
    expect((await response.clone().json())).not.toHaveProperty("data");
    // 404 and not 403: a 403 would confirm the id names a real order, which is
    // an oracle an attacker can walk.
    expect((await errorOf(response)).code).toBe("not_found");
    // And the ownership is IN the query — a version that read the row first and
    // compared afterwards would still pass the assertions above.
    expect(mocks.findFirstOrder.mock.calls[0]![0].where).toEqual({
      id: "ord_belonging_to_b",
      userId: "usr_a",
    });
  });

  it("does not restrict by role: a seller who has bought something has orders too", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "usr_s" } });
    mocks.findUniqueUser.mockResolvedValue({
      role: "SELLER_OWNER", status: "ACTIVE", deletedAt: null, companyMember: null,
    });
    expect((await GET_LIST(get("/api/v1/orders"))).status).toBe(200);
  });
});

describe("the order list", () => {
  beforeEach(() => signedInAs("usr_a"));

  it("answers lean cards inside the page envelope", async () => {
    const page = OrderListResponseSchema.parse(await (await GET_LIST(get("/api/v1/orders"))).json());
    expect(page.data[0]).toEqual({
      id: "a",
      orderNumber: "AV-A",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      type: "B2C",
      currency: "AED",
      total: 236.25,
      // The TRUE line count, from _count — not the length of the thumbnail window.
      itemCount: 3,
      thumbnail: { url: "https://placehold.co/600x600/x", width: 600, height: 600, alt: "Helmet" },
      placedAt: "2026-03-03T00:00:00.000Z",
    });
  });

  it("takes the first item that HAS an image, not merely the first item", async () => {
    const page = OrderListResponseSchema.parse(await (await GET_LIST(get("/api/v1/orders"))).json());
    expect(page.data[0]!.thumbnail).not.toBeNull();
  });

  it("cursors on (placedAt, id), and the cursor round-trips", async () => {
    mocks.findManyOrders.mockResolvedValue([
      cardRow("a", "2026-03-03T00:00:00.000Z"),
      cardRow("b", "2026-03-02T00:00:00.000Z"),
    ]);
    const first = OrderListResponseSchema.parse(
      await (await GET_LIST(get("/api/v1/orders?limit=1"))).json(),
    );
    expect(first.data.map((row) => row.id)).toEqual(["a"]);
    expect(first.meta.hasMore).toBe(true);

    mocks.findManyOrders.mockResolvedValue([cardRow("b", "2026-03-02T00:00:00.000Z")]);
    const second = OrderListResponseSchema.parse(
      await (await GET_LIST(
        get(`/api/v1/orders?limit=1&cursor=${encodeURIComponent(first.meta.cursor!)}`),
      )).json(),
    );
    expect(second.data.map((row) => row.id)).toEqual(["b"]);
    expect(mocks.findManyOrders.mock.calls[1]![0].where.AND).toEqual([
      {
        OR: [
          { createdAt: { lt: new Date("2026-03-03T00:00:00.000Z") } },
          { createdAt: new Date("2026-03-03T00:00:00.000Z"), id: { gt: "a" } },
        ],
      },
    ]);
  });

  it("keeps the owner scope on the SECOND page too", async () => {
    mocks.findManyOrders.mockResolvedValue([
      cardRow("a", "2026-03-03T00:00:00.000Z"),
      cardRow("b", "2026-03-02T00:00:00.000Z"),
    ]);
    const first = OrderListResponseSchema.parse(
      await (await GET_LIST(get("/api/v1/orders?limit=1"))).json(),
    );
    await GET_LIST(get(`/api/v1/orders?limit=1&cursor=${encodeURIComponent(first.meta.cursor!)}`));
    expect(mocks.findManyOrders.mock.calls[1]![0].where).toMatchObject({ userId: "usr_a" });
  });

  it("answers 400 for a malformed cursor", async () => {
    const response = await GET_LIST(get("/api/v1/orders?cursor=%%%"));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.cursor).toBeDefined();
    expect(mocks.findManyOrders).not.toHaveBeenCalled();
  });

  it("refuses a status the enum does not hold", async () => {
    const response = await GET_LIST(get("/api/v1/orders?status=ALMOST_THERE"));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.status).toBeDefined();
  });

  it("passes a valid status straight into the predicate", async () => {
    await GET_LIST(get("/api/v1/orders?status=RETURN_REQUESTED"));
    expect(mocks.findManyOrders.mock.calls[0]![0].where).toMatchObject({ status: "RETURN_REQUESTED" });
  });
});

describe("the order detail", () => {
  beforeEach(() => signedInAs("usr_a"));

  const read = () => GET_DETAIL(get("/api/v1/orders/ord_1"), { params: { id: "ord_1" } });

  it("conforms to the contract, money and all", async () => {
    const { data } = OrderDetailResponseSchema.parse(await (await read()).json());
    expect(data.totals).toEqual({
      subtotal: 200,
      discountAmount: 0,
      shippingAmount: 25,
      vatAmount: 11.25,
      goodsVatAmount: null,
      shippingVatAmount: null,
      total: 236.25,
    });
    expect(data.items[0]).toMatchObject({
      sku: "SKU-1",
      slug: "safety-helmet",
      quantity: 2,
      unitPrice: 100,
      vatRatePercent: 5,
      vatAmount: 10,
      total: 200,
    });
    expect(data.shippingAddress).toEqual({
      label: "Home",
      line1: "12 Marina Street",
      city: "Dubai",
      country: "AE",
    });
  });

  it("reports the VAT components as NULL rather than deriving them", async () => {
    // Nothing writes these columns yet. `goodsVatAmount = vatAmount` would be
    // wrong by the freight's VAT and indistinguishable from a measured figure.
    const { data } = OrderDetailResponseSchema.parse(await (await read()).json());
    expect(data.totals.goodsVatAmount).toBeNull();
    expect(data.totals.shippingVatAmount).toBeNull();
    expect(data.totals.vatAmount).toBe(11.25);
  });

  it("carries the components through once the write path records them", async () => {
    mocks.findFirstOrder.mockResolvedValue({
      ...DETAIL_ROW,
      goodsVatAmount: dec("10.00"),
      shippingVatAmount: dec("1.25"),
    });
    const { data } = OrderDetailResponseSchema.parse(await (await read()).json());
    expect(data.totals.goodsVatAmount).toBe(10);
    expect(data.totals.shippingVatAmount).toBe(1.25);
  });

  it("refuses a HALF-recorded split at the contract itself", () => {
    // The guard that makes the two assertions above meaningful: one component
    // alone invites the reader to infer the other by subtraction and be wrong.
    const outcome = PersistedOrderTotalsSchema.safeParse({
      subtotal: 200, discountAmount: 0, shippingAmount: 25,
      vatAmount: 11.25, goodsVatAmount: 10, shippingVatAmount: null, total: 236.25,
    });
    expect(outcome.success).toBe(false);
  });

  it("reads a history forwards, capped at the contract's ceiling", async () => {
    const { data } = OrderDetailResponseSchema.parse(await (await read()).json());
    expect(data.statusHistory.map((event) => event.status)).toEqual(["CONFIRMED", "SHIPPED"]);
    // Newest-first in the query so a long-running order keeps its RECENT
    // history under the cap, reversed for presentation.
    expect(mocks.findFirstOrder.mock.calls[0]![0].select.statusHistory).toMatchObject({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

  it("states a tracking URL as absent, because no column and no template exists", async () => {
    const { data } = OrderDetailResponseSchema.parse(await (await read()).json());
    expect(data.shipments[0]).toEqual({
      id: "shp_1",
      status: "IN_TRANSIT",
      carrier: "Aramex",
      trackingNumber: "TRK-9",
      trackingUrl: null,
      estimatedDelivery: "2026-03-05T00:00:00.000Z",
    });
  });

  it("projects the stored address rather than passing the JSON column through", async () => {
    // The column is unconstrained Json and the contract's address is .strict();
    // an extra key from some future writer would otherwise 500 every order.
    mocks.findFirstOrder.mockResolvedValue({
      ...DETAIL_ROW,
      shippingAddress: {
        label: "Home", line1: "12 Marina Street", city: "Dubai", country: "AE",
        legacyRegionCode: "DXB", geo: { lat: 25.2 },
      },
    });
    const response = await read();
    expect(response.status).toBe(200);
    const { data } = OrderDetailResponseSchema.parse(await response.json());
    expect(Object.keys(data.shippingAddress).sort()).toEqual(["city", "country", "label", "line1"]);
  });

  it("refuses to render an order whose destination cannot be stated", async () => {
    mocks.findFirstOrder.mockResolvedValue({ ...DETAIL_ROW, shippingAddress: { city: "Dubai" } });
    const response = await read();
    expect(response.status).toBe(500);
    expect((await errorOf(response)).code).toBe("internal");
    expect(mocks.logError).toHaveBeenCalledWith(
      "v1 response violates its contract",
      expect.anything(),
      expect.objectContaining({ route: "/api/v1/orders/[id]" }),
    );
  });
});
