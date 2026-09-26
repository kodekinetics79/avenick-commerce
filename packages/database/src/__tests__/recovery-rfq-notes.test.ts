import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ create: vi.fn(), transaction: vi.fn(), authorize: vi.fn() }));
// Replace the database entry point entirely; no Prisma client is instantiated.
vi.mock("../index", () => ({
  db: { rFQRequest: { create: mocks.create }, $transaction: mocks.transaction },
  AuditAction: { UPDATE: "UPDATE" },
}));
vi.mock("../services/checkout-invariants", () => ({ requireCurrentSellerActor: mocks.authorize }));

import { createRFQ, submitQuote } from "../services/rfq";

const requirements = "Subject: Pumps · Category: Industrial · Delivery: Riyadh · Priority: High · Certified parts only";
function initialState() {
  return {
    rfq: {
      id: "rfq", buyerId: "buyer", companyId: "company", sellerId: null as string | null,
      status: "SUBMITTED", currency: "SAR", notes: requirements, quoteVersion: 0,
      totalQuoted: null as number | null,
      items: [
        { id: "item-a", quantity: 2, unitQuoted: null as number | null, notes: "Target: 15 SAR/unit" },
        { id: "item-b", quantity: 3, unitQuoted: null as number | null, notes: "Certified" },
      ],
    },
    messages: [] as Prisma.MessageUncheckedCreateInput[],
    audits: [] as Prisma.AuditLogUncheckedCreateInput[],
  };
}
let state = initialState();
let failMessage = false;
let failAudit = false;
let loseClaim = false;
let transactionClient: unknown;

beforeEach(() => {
  vi.resetAllMocks();
  state = initialState();
  failMessage = failAudit = loseClaim = false;
  mocks.authorize.mockResolvedValue(undefined);
  // An isolated transactional fake: publish staged writes only on success.
  // This checks service transaction composition, not PostgreSQL concurrency.
  mocks.transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => {
    const staged = structuredClone(state);
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      rFQRequest: {
        findUnique: vi.fn(async () => structuredClone(staged.rfq)),
        updateMany: vi.fn(async ({ where, data }) => {
          expect(where).toEqual({
            id: "rfq", status: staged.rfq.status, quoteVersion: staged.rfq.quoteVersion,
            OR: [{ sellerId: null }, { sellerId: "seller" }],
          });
          if (loseClaim) return { count: 0 };
          Object.assign(staged.rfq, data);
          return { count: 1 };
        }),
        findUniqueOrThrow: vi.fn(async () => structuredClone(staged.rfq)),
      },
      rFQItem: {
        update: vi.fn(async ({ where, data }) => {
          Object.assign(staged.rfq.items.find((item) => item.id === where.id)!, data);
        }),
      },
      message: {
        create: vi.fn(async ({ data }: { data: Prisma.MessageUncheckedCreateInput }) => {
          if (failMessage) throw new Error("message write failed");
          staged.messages.push(data);
          return { id: `message-${staged.messages.length}`, ...data };
        }),
      },
      auditLog: {
        create: vi.fn(async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => {
          if (failAudit) throw new Error("audit write failed");
          staged.audits.push(data);
        }),
      },
    };
    transactionClient = tx;
    const result = await work(tx);
    state = staged;
    return result;
  });
});

const quote = (notes?: string, actorId = "seller-owner", unitQuoted = 10) => submitQuote({
  rfqId: "rfq", sellerId: "seller", actorId, notes,
  items: [{ itemId: "item-b", unitQuoted: 5 }, { itemId: "item-a", unitQuoted }],
});

describe("RFQ persistence", () => {
  it.each(["SAR", "KWD", "AED"] as const)("persists explicit creation currency %s and buyer notes", async (currency) => {
    mocks.create.mockImplementation(async ({ data }) => ({ id: "new-rfq", ...data }));
    const existing = structuredClone(state);
    const created = await createRFQ({
      buyerId: "buyer", companyId: "company", currency, notes: requirements,
      items: [{ nameEn: "Pump", quantity: 2, notes: "Certified" }],
    });
    expect(created).toMatchObject({ currency, notes: requirements, status: "SUBMITTED" });
    expect(state).toEqual(existing);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("preserves buyer requirements and existing currency through a quote and revision with attributed notes", async () => {
    const first = await quote("Available next week");
    expect(first).toMatchObject({ notes: requirements, currency: "SAR", quoteVersion: 1, totalQuoted: 35 });
    const revised = await quote("Revised lead time: two weeks", "seller-staff", 12);
    expect(revised).toMatchObject({ notes: requirements, currency: "SAR", quoteVersion: 2, totalQuoted: 39 });
    expect(state.rfq.items).toEqual([
      { id: "item-a", quantity: 2, unitQuoted: 12, notes: "Target: 15 SAR/unit" },
      { id: "item-b", quantity: 3, unitQuoted: 5, notes: "Certified" },
    ]);
    expect(state.messages).toEqual([
      expect.objectContaining({ rfqId: "rfq", senderId: "seller-owner", senderType: "SELLER", body: "Available next week" }),
      expect.objectContaining({ rfqId: "rfq", senderId: "seller-staff", senderType: "SELLER", body: "Revised lead time: two weeks" }),
    ]);
    expect(mocks.authorize).toHaveBeenLastCalledWith(transactionClient, "seller-staff", "seller", "quotes.submit");
    expect(state.audits).toEqual([
      { actorId: "seller-owner", sellerId: "seller", entityType: "RFQRequest", entityId: "rfq", action: "UPDATE",
        before: { status: "SUBMITTED", quoteVersion: 0, totalQuoted: null },
        after: { status: "QUOTED", quoteVersion: 1, totalQuoted: 35 } },
      { actorId: "seller-staff", sellerId: "seller", entityType: "RFQRequest", entityId: "rfq", action: "UPDATE",
        before: { status: "QUOTED", quoteVersion: 1, totalQuoted: 35 },
        after: { status: "QUOTED", quoteVersion: 2, totalQuoted: 39 } },
    ]);
  });

  it.each([undefined, "", "   "])("does not add a message for empty notes (%s)", async (notes) => {
    await quote(notes);
    expect(state.rfq.notes).toBe(requirements);
    expect(state.messages).toEqual([]);
    expect(state.rfq.quoteVersion).toBe(1);
    expect(state.audits).toHaveLength(1);
  });

  it.each(["message", "audit"])("rolls back quote, notes and audit when the %s write fails", async (failure) => {
    failMessage = failure === "message";
    failAudit = failure === "audit";
    const before = structuredClone(state);
    await expect(quote("Must be atomic")).rejects.toThrow(`${failure} write failed`);
    expect(state).toEqual(before);
  });

  it.each(["authorization", "other seller", "closed", "concurrent claim"])(
    "does not persist a note or quote on %s refusal", async (reason) => {
      if (reason === "authorization") mocks.authorize.mockRejectedValue(new Error("Current seller permission required"));
      if (reason === "other seller") state.rfq.sellerId = "other-seller";
      if (reason === "closed") state.rfq.status = "ACCEPTED";
      if (reason === "concurrent claim") loseClaim = true;
      const before = structuredClone(state);
      await expect(quote("Unauthorized note")).rejects.toThrow();
      expect(state).toEqual(before);
      expect(mocks.authorize).toHaveBeenCalledWith(transactionClient, "seller-owner", "seller", "quotes.submit");
    },
  );
});
