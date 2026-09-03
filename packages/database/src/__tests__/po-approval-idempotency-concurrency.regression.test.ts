import { describe, expect, it } from "vitest";
import {
  assertMatchingIdempotencyFingerprint,
  buildApprovalDecisionSnapshot,
  canonicalOrderRequest,
  commercialSnapshotFingerprint,
} from "../services/commerce-governance";
import { db } from "../index";
import { transitionGovernedPurchaseOrder } from "../services/b2b-purchase-orders";

describe("canonical checkout idempotency", () => {
  const request = {
    items: [
      { productId: "b", variantId: "v", quantity: 1 },
      { productId: "a", quantity: 2 },
      { productId: "a", quantity: 3 },
    ],
    shippingAddress: { country: "AE", city: "Dubai", line1: "1 Main", label: "HQ" },
    paymentMethod: "BANK_TRANSFER",
    currency: "AED",
    type: "B2B",
    couponCode: "SAVE_5",
    notes: "deliver",
  };

  it("canonicalizes equivalent item ordering and duplicate lines identically", () => {
    const retry = { ...request, items: [request.items[1]!, request.items[0]!, request.items[2]!] };
    expect(canonicalOrderRequest(retry)).toBe(canonicalOrderRequest(request));
  });

  it("rejects concurrent reuse of a key for a different canonical request", () => {
    const stored = canonicalOrderRequest(request);
    expect(() => assertMatchingIdempotencyFingerprint(stored, stored)).not.toThrow();
    expect(() => assertMatchingIdempotencyFingerprint(stored, canonicalOrderRequest({ ...request, notes: "changed" })))
      .toThrow(/different request/i);
  });
});

describe("immutable purchase-order approval evidence", () => {
  const lines = [{ productId: "p", variantId: null, quantity: 2, unitPrice: 100, vatRate: 5, priceSourceId: "price-1" }];

  it("fingerprints all approved commercial facts", () => {
    expect(commercialSnapshotFingerprint("AED", 210, lines)).not.toBe(
      commercialSnapshotFingerprint("AED", 210, [{ ...lines[0]!, unitPrice: 101 }]),
    );
  });

  it("captures the exact governing policy version for reapproval checks", () => {
    const snapshot = buildApprovalDecisionSnapshot({
      commercialFingerprint: commercialSnapshotFingerprint("AED", 210, lines),
      requesterSpendLimit: 500,
      policy: {
        id: "policy-1",
        name: "Large orders",
        thresholdAmount: 100,
        currency: "AED",
        approverRole: "COMPANY_APPROVER",
        updatedAt: new Date("2026-08-13T00:00:00.000Z"),
      },
    });
    expect(snapshot.policy).toMatchObject({ id: "policy-1", version: "2026-08-13T00:00:00.000Z" });
    expect(snapshot.requesterSpendLimit).toBe(500);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});

describe.skipIf(!process.env["DATABASE_URL"])("database concurrency fencing", () => {
  it("allows exactly one of concurrent approve/reject transitions to commit", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const actor = await db.user.create({ data: {
      email: `po-concurrency-${stamp}@example.test`,
      firstName: "PO",
      lastName: "Approver",
      role: "COMPANY_APPROVER",
      status: "ACTIVE",
    } });
    const company = await db.company.create({ data: {
      nameEn: `PO Concurrency ${stamp}`,
      industry: "OTHER",
      size: "SMALL",
      country: "AE",
      city: "Dubai",
      status: "ACTIVE",
      members: { create: { userId: actor.id, role: "COMPANY_APPROVER", isActive: true } },
    } });
    const po = await db.purchaseOrder.create({ data: {
      poNumber: `PO-CONCURRENT-${stamp}`,
      companyId: company.id,
      requesterId: `requester-${stamp}`,
      status: "PENDING_APPROVAL",
      currency: "AED",
      total: 100,
    } });

    try {
      const results = await Promise.allSettled([
        transitionGovernedPurchaseOrder({
          purchaseOrderId: po.id, companyId: company.id, actorId: actor.id,
          action: "approve",
        }),
        transitionGovernedPurchaseOrder({
          purchaseOrderId: po.id, companyId: company.id, actorId: actor.id,
          action: "reject",
        }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(await db.auditLog.count({ where: { entityType: "PurchaseOrder", entityId: po.id } })).toBe(1);
    } finally {
      await db.auditLog.deleteMany({ where: { entityType: "PurchaseOrder", entityId: po.id } });
      await db.purchaseOrder.delete({ where: { id: po.id } });
      await db.companyMember.deleteMany({ where: { companyId: company.id } });
      await db.company.delete({ where: { id: company.id } });
      await db.user.delete({ where: { id: actor.id } });
    }
  });

  it("database uniqueness gives one winner for concurrent mismatched idempotency requests", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const user = await db.user.create({ data: {
      email: `idem-concurrency-${stamp}@example.test`, firstName: "Idem", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE",
    } });
    const key = `idem-${stamp}`;
    const fingerprints = ["canonical-request-a", "canonical-request-b"];
    try {
      const results = await Promise.allSettled(fingerprints.map((requestFingerprint, index) => db.order.create({ data: {
        orderNumber: `AVN-IDEM-${stamp}-${index}`,
        userId: user.id,
        type: "B2C",
        currency: "AED",
        subtotal: 10,
        vatAmount: 0.5,
        total: 10.5,
        shippingAddress: { country: "AE" },
        idempotencyKey: key,
        requestFingerprint,
      } })));
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const stored = await db.order.findUniqueOrThrow({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: key } } });
      const losingFingerprint = fingerprints.find((fingerprint) => fingerprint !== stored.requestFingerprint)!;
      expect(() => assertMatchingIdempotencyFingerprint(stored.requestFingerprint, losingFingerprint)).toThrow(/different request/i);
    } finally {
      await db.order.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
  });
});
