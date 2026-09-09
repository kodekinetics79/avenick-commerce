import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorEnvelopeSchema, RfqDetailSchema, RfqListResponseSchema, RfqResponseSchema } from "@avenick/contracts";

/**
 * /api/v1/rfqs — the buying journey for a quote-only catalogue.
 *
 * Almost nothing here is consumer-sellable, so "Request a quote" is the primary
 * action on most product pages rather than a B2B side-door. Three properties
 * carry this file:
 *
 *  1. A CONSUMER CAN RAISE ONE. `/api/b2b/rfqs` refuses anyone without a
 *     company; that gate would make the button dead for every consumer who taps
 *     it, so it is deliberately absent here and tested for.
 *  2. OWNER SCOPING. The buyer services build `buyerId = me` (widened to the
 *     caller's company) into the query, so another buyer's RFQ is never read.
 *     The tests assert the ids handed to the service, not just the 404 — a
 *     version that read first and compared afterwards would pass on the status
 *     alone.
 *  3. ONE RFQ, ONE SUPPLIER. `RFQRequest.sellerId` is a single nullable column,
 *     so there is no comparison of competing quotes and the contract refuses to
 *     describe one.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  findManyProducts: vi.fn(),
  createRFQ: vi.fn(),
  getRFQsForBuyer: vi.fn(),
  getRFQForBuyer: vi.fn(),
  decideRFQ: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true, count: 1, limit: 10, resetAt: Date.now() + 60_000 }),
  clientIpFrom: () => "203.0.113.7",
}));
vi.mock("@avenick/observability", () => {
  const log = { error: mocks.logError, info: vi.fn(), warn: vi.fn(), debug: vi.fn(), with: () => log };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});
vi.mock("@avenick/database", () => ({
  db: { user: { findUnique: mocks.findUniqueUser }, product: { findMany: mocks.findManyProducts } },
  PUBLIC_CATALOG_SELLER: { is: { deletedAt: null, status: "ACTIVE" } },
  createRFQ: mocks.createRFQ,
  getRFQsForBuyer: mocks.getRFQsForBuyer,
  getRFQForBuyer: mocks.getRFQForBuyer,
  decideRFQ: mocks.decideRFQ,
}));

import { POST as DECIDE } from "../[id]/decision/route";
import { GET as GET_ONE } from "../[id]/route";
import { GET as GET_LIST, POST as CREATE } from "../route";

const dec = (value: string) => ({ toString: () => value });

function rfqRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rfq_1",
    rfqNumber: "RFQ-2026-001",
    status: "SUBMITTED",
    currency: "AED",
    totalQuoted: null,
    quoteVersion: 0,
    requiredBy: new Date("2026-10-04T08:30:00.000Z"),
    createdAt: new Date("2026-09-04T08:30:00.000Z"),
    updatedAt: new Date("2026-09-04T08:30:00.000Z"),
    notes: "Need 5000 bags for Q2.",
    expiresAt: null,
    seller: null,
    items: [
      { id: "rfqi_1", productId: "prod_1", nameEn: "OPC Portland Cement 50kg", quantity: 5000, unitQuoted: null, notes: null },
    ],
    ...overrides,
  };
}

const listRow = (overrides: Record<string, unknown> = {}) => ({
  ...rfqRow(overrides),
  _count: { messages: 2 },
});

const detailRow = (overrides: Record<string, unknown> = {}) => ({
  ...rfqRow(overrides),
  messageTotal: 2,
});

function get(path: string) {
  return new NextRequest(`https://customer.test${path}`, { method: "GET" });
}

function send(path: string, body: unknown) {
  return new NextRequest(`https://customer.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

function signedIn(userId: string, companyId: string | null = null) {
  mocks.auth.mockResolvedValue({ user: { id: userId } });
  mocks.findUniqueUser.mockResolvedValue({
    role: companyId ? "COMPANY_BUYER" : "CONSUMER",
    status: "ACTIVE",
    deletedAt: null,
    companyMember: companyId
      ? { companyId, isActive: true, company: { status: "ACTIVE", deletedAt: null } }
      : null,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.getRFQsForBuyer.mockResolvedValue([listRow()]);
  mocks.getRFQForBuyer.mockResolvedValue(detailRow());
  mocks.createRFQ.mockResolvedValue({ id: "rfq_1" });
  mocks.findManyProducts.mockResolvedValue([{ id: "prod_1", nameEn: "OPC Portland Cement 50kg" }]);
});

describe("who may use the quote journey", () => {
  it("refuses a guest every verb", async () => {
    expect((await GET_LIST(get("/api/v1/rfqs"))).status).toBe(401);
    expect((await CREATE(send("/api/v1/rfqs", { items: [{ nameEn: "Cement", quantity: 10 }], currency: "AED" }))).status).toBe(401);
    expect((await GET_ONE(get("/api/v1/rfqs/rfq_1"), { params: { id: "rfq_1" } })).status).toBe(401);
    expect(mocks.createRFQ).not.toHaveBeenCalled();
  });

  it("SERVES A CONSUMER WITH NO COMPANY, which the b2b route refuses", async () => {
    // The catalogue is quote-only, so a consumer tapping "Request a quote" is
    // the common case. Gating on a company would make the button dead.
    signedIn("usr_consumer", null);
    const response = await CREATE(send("/api/v1/rfqs", {
      items: [{ productId: "prod_1", quantity: 500 }],
      currency: "AED",
    }));
    expect(response.status).toBe(200);
    expect(mocks.createRFQ.mock.calls[0]![0]).toMatchObject({ buyerId: "usr_consumer" });
    // No company attached, so no colleague inherits visibility of a personal RFQ.
    expect(mocks.createRFQ.mock.calls[0]![0].companyId).toBeUndefined();
  });

  it("attaches a live company so colleagues can see the request", async () => {
    signedIn("usr_b2b", "comp_1");
    await CREATE(send("/api/v1/rfqs", { items: [{ productId: "prod_1", quantity: 500 }], currency: "AED" }));
    expect(mocks.createRFQ.mock.calls[0]![0]).toMatchObject({ buyerId: "usr_b2b", companyId: "comp_1" });
  });
});

describe("owner scoping", () => {
  it("reads the list with the caller's own ids", async () => {
    signedIn("usr_a", "comp_1");
    await GET_LIST(get("/api/v1/rfqs"));
    expect(mocks.getRFQsForBuyer).toHaveBeenCalledWith({ buyerId: "usr_a", companyId: "comp_1" });
  });

  it("does not widen a consumer's list to any company", async () => {
    signedIn("usr_a", null);
    await GET_LIST(get("/api/v1/rfqs"));
    expect(mocks.getRFQsForBuyer).toHaveBeenCalledWith({ buyerId: "usr_a" });
  });

  /** THE SECURITY PROPERTY: buyer A asks for buyer B's request. */
  it("does not let one buyer read another's RFQ", async () => {
    signedIn("usr_a");
    mocks.getRFQForBuyer.mockResolvedValue(null);

    const response = await GET_ONE(get("/api/v1/rfqs/rfq_of_b"), { params: { id: "rfq_of_b" } });

    expect(response.status).toBe(404);
    expect(await response.clone().json()).not.toHaveProperty("data");
    // 404, not 403: a 403 confirms the id names a real request.
    expect((await errorOf(response)).code).toBe("not_found");
    // And the caller's identity went INTO the lookup — a version that read the
    // row and compared afterwards would still pass the assertions above.
    expect(mocks.getRFQForBuyer).toHaveBeenCalledWith({ rfqId: "rfq_of_b", buyerId: "usr_a" });
  });

  it("does not let one buyer DECIDE another's RFQ", async () => {
    signedIn("usr_a");
    mocks.decideRFQ.mockRejectedValue(new Error("RFQ not found"));
    const response = await DECIDE(
      send("/api/v1/rfqs/rfq_of_b/decision", { decision: "ACCEPTED", expectedQuoteVersion: 1 }),
      { params: { id: "rfq_of_b" } },
    );
    expect(response.status).toBe(404);
    expect(mocks.decideRFQ.mock.calls[0]![0]).toMatchObject({ rfqId: "rfq_of_b", buyerId: "usr_a" });
  });
});

describe("the list", () => {
  beforeEach(() => signedIn("usr_a"));

  it("answers lean cards conforming to the contract", async () => {
    const response = await GET_LIST(get("/api/v1/rfqs"));
    expect(response.status).toBe(200);
    const { data } = RfqListResponseSchema.parse(await response.json());
    expect(data[0]).toEqual({
      id: "rfq_1",
      rfqNumber: "RFQ-2026-001",
      status: "SUBMITTED",
      currency: "AED",
      itemCount: 1,
      totalQuoted: null,
      quoteVersion: 0,
      seller: null,
      requiredBy: "2026-10-04T08:30:00.000Z",
      createdAt: "2026-09-04T08:30:00.000Z",
      messageCount: 2,
    });
  });

  it("is uncursored, because the service reads a fixed page", async () => {
    const body = await (await GET_LIST(get("/api/v1/rfqs"))).json();
    expect(body).not.toHaveProperty("meta");
  });

  it("reads a quoted total through the Decimal's exact string", async () => {
    mocks.getRFQsForBuyer.mockResolvedValue([
      listRow({ status: "QUOTED", totalQuoted: dec("37500.00"), quoteVersion: 1, seller: { businessNameEn: "Gulf Safety", tier: "VERIFIED" } }),
    ]);
    const { data } = RfqListResponseSchema.parse(await (await GET_LIST(get("/api/v1/rfqs"))).json());
    expect(data[0]).toMatchObject({
      totalQuoted: 37500,
      quoteVersion: 1,
      seller: { businessNameEn: "Gulf Safety", tier: "VERIFIED" },
    });
  });
});

describe("one request, and the single supplier it can carry", () => {
  beforeEach(() => signedIn("usr_a"));

  const read = () => GET_ONE(get("/api/v1/rfqs/rfq_1"), { params: { id: "rfq_1" } });

  it("answers the fat DTO with its lines", async () => {
    mocks.getRFQForBuyer.mockResolvedValue(detailRow({
      status: "QUOTED",
      quoteVersion: 1,
      totalQuoted: dec("37500.00"),
      seller: { businessNameEn: "Gulf Safety", tier: "VERIFIED" },
      items: [{ id: "rfqi_1", productId: "prod_1", nameEn: "Cement 50kg", quantity: 5000, unitQuoted: dec("7.50"), notes: null }],
    }));
    const { data } = RfqResponseSchema.parse(await (await read()).json());
    expect(data.items).toEqual([
      { id: "rfqi_1", productId: "prod_1", nameEn: "Cement 50kg", quantity: 5000, unitQuoted: 7.5, notes: null },
    ]);
    expect(data.totalQuoted).toBe(37500);
  });

  it("carries NO per-line total, because only the aggregate is authoritative", async () => {
    // submitQuote rounds the sum once; rounding each line here and letting the
    // app add them up can differ by cents — two numbers on one screen that do
    // not agree.
    const { data } = RfqResponseSchema.parse(await (await read()).json());
    expect(Object.keys(data.items[0]!)).not.toContain("lineTotal");
  });

  it("carries no competing quotes, because the schema holds ONE supplier", async () => {
    const { data } = RfqResponseSchema.parse(await (await read()).json());
    expect(Object.keys(data)).not.toContain("quotes");
    // RFQRequest.sellerId is a single nullable column: null until one seller
    // claims the request, and never a list.
    expect(data.seller).toBeNull();
    expect(RfqDetailSchema.safeParse({ ...data, quotes: [] }).success).toBe(false);
  });

  it("reports expiresAt as null, because nothing writes that column", async () => {
    const { data } = RfqResponseSchema.parse(await (await read()).json());
    expect(data.expiresAt).toBeNull();
  });
});

describe("raising a request", () => {
  beforeEach(() => signedIn("usr_a"));

  it("names a catalogue line FROM THE CATALOGUE, ignoring what the client sent", async () => {
    // RFQItem.nameEn is what the supplier reads as the specification. Letting a
    // client-supplied name disagree with the productId beside it produces a
    // request for "500 of [X]" pointing at something else entirely.
    await CREATE(send("/api/v1/rfqs", {
      items: [{ productId: "prod_1", nameEn: "Something else entirely", quantity: 500 }],
      currency: "AED",
    }));
    expect(mocks.createRFQ.mock.calls[0]![0].items).toEqual([
      { productId: "prod_1", nameEn: "OPC Portland Cement 50kg", quantity: 500, notes: undefined },
    ]);
  });

  it("keeps a free-text line's own name, which is what an RFQ is for", async () => {
    mocks.findManyProducts.mockResolvedValue([]);
    await CREATE(send("/api/v1/rfqs", {
      items: [{ nameEn: "Safety boots, assorted sizes", quantity: 200 }],
      currency: "AED",
    }));
    expect(mocks.createRFQ.mock.calls[0]![0].items).toEqual([
      { nameEn: "Safety boots, assorted sizes", quantity: 200, notes: undefined },
    ]);
    expect(mocks.findManyProducts).not.toHaveBeenCalled();
  });

  it("refuses a line that neither names a product nor says what is wanted", async () => {
    const response = await CREATE(send("/api/v1/rfqs", { items: [{ quantity: 500 }], currency: "AED" }));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.["items.0.nameEn"]).toBeDefined();
    expect(mocks.createRFQ).not.toHaveBeenCalled();
  });

  it("answers 404 for a product no supplier can be asked about", async () => {
    mocks.findManyProducts.mockResolvedValue([]);
    const response = await CREATE(send("/api/v1/rfqs", {
      items: [{ productId: "prod_gone", quantity: 500 }],
      currency: "AED",
    }));
    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe("not_found");
    expect(mocks.createRFQ).not.toHaveBeenCalled();
  });

  it("does NOT require a product to be consumer-sellable", async () => {
    // isB2CEnabled is false on every pilot row. Gating here would make "Request
    // a quote" refuse the entire catalogue it exists to serve.
    await CREATE(send("/api/v1/rfqs", { items: [{ productId: "prod_1", quantity: 5 }], currency: "AED" }));
    const where = mocks.findManyProducts.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      status: "ACTIVE",
      deletedAt: null,
      isPubliclyDiscoverable: true,
      seller: { is: { deletedAt: null, status: "ACTIVE" } },
    });
    expect(Object.keys(where)).not.toContain("isB2CEnabled");
  });

  it("requires the currency rather than defaulting it to AED", async () => {
    const response = await CREATE(send("/api/v1/rfqs", { items: [{ productId: "prod_1", quantity: 5 }] }));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.currency).toBeDefined();
  });

  it("answers the created request in full, re-read through one projection", async () => {
    const response = await CREATE(send("/api/v1/rfqs", {
      items: [{ productId: "prod_1", quantity: 500 }],
      currency: "AED",
      notes: "Q2 project",
      requiredBy: "2026-10-04T08:30:00.000Z",
    }));
    expect(response.status).toBe(200);
    RfqResponseSchema.parse(await response.json());
    expect(mocks.createRFQ.mock.calls[0]![0].requiredBy).toEqual(new Date("2026-10-04T08:30:00.000Z"));
    expect(mocks.getRFQForBuyer).toHaveBeenCalledWith({ rfqId: "rfq_1", buyerId: "usr_a" });
  });
});

describe("deciding a quote", () => {
  beforeEach(() => {
    signedIn("usr_a");
    mocks.decideRFQ.mockResolvedValue({ id: "rfq_1" });
    mocks.getRFQForBuyer.mockResolvedValue(detailRow({ status: "ACCEPTED", quoteVersion: 1, totalQuoted: dec("37500.00") }));
  });

  const decide = (body: unknown) =>
    DECIDE(send("/api/v1/rfqs/rfq_1/decision", body), { params: { id: "rfq_1" } });

  it("accepts a quote and answers the request in its new state", async () => {
    const response = await decide({ decision: "ACCEPTED", expectedQuoteVersion: 1 });
    expect(response.status).toBe(200);
    const { data } = RfqResponseSchema.parse(await response.json());
    expect(data.status).toBe("ACCEPTED");
    expect(mocks.decideRFQ).toHaveBeenCalledWith({
      rfqId: "rfq_1",
      buyerId: "usr_a",
      decision: "ACCEPTED",
      expectedQuoteVersion: 1,
    });
  });

  it("REQUIRES the version the decision was made against", async () => {
    // Without it the buyer can accept a price the supplier revised while the
    // screen was open.
    const response = await decide({ decision: "ACCEPTED" });
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.expectedQuoteVersion).toBeDefined();
    expect(mocks.decideRFQ).not.toHaveBeenCalled();
  });

  it("reports a quote that moved as a conflict, saying so", async () => {
    mocks.decideRFQ.mockRejectedValue(
      new Error("Quote changed since it was viewed; review the latest quote before deciding"),
    );
    const response = await decide({ decision: "ACCEPTED", expectedQuoteVersion: 1 });
    expect(response.status).toBe(409);
    const error = await errorOf(response);
    expect(error.code).toBe("conflict");
    expect(error.message).toMatch(/latest quote/i);
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it("reports a decision on an unquoted request as a conflict", async () => {
    mocks.decideRFQ.mockRejectedValue(new Error("Only quoted RFQs can be accepted or rejected"));
    const response = await decide({ decision: "REJECTED", expectedQuoteVersion: 0 });
    expect(response.status).toBe(409);
  });

  it("refuses a decision the enum does not hold", async () => {
    const response = await decide({ decision: "MAYBE", expectedQuoteVersion: 1 });
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.decision).toBeDefined();
  });

  it("reports an unexpected fault as internal, and logs it", async () => {
    mocks.decideRFQ.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.4:5432"));
    const response = await decide({ decision: "ACCEPTED", expectedQuoteVersion: 1 });
    expect(response.status).toBe(500);
    expect((await errorOf(response)).message).not.toMatch(/ECONNREFUSED/);
    expect(mocks.logError).toHaveBeenCalled();
  });
});
