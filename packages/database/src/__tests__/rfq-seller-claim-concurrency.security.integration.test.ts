import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { submitQuote } from "../services/rfq";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const created = { users: [] as string[], sellers: [] as string[] };
let rfqId = "";
let itemId = "";
let sellerAId = "";
let sellerBId = "";
let actorAId = "";
let actorBId = "";

beforeAll(async () => {
  const buyer = await db.user.create({ data: {
    email: `rfq-buyer-${stamp}@example.test`, firstName: "RFQ", lastName: "Buyer",
    role: "CONSUMER", status: "ACTIVE",
  } });
  const [ownerA, ownerB] = await Promise.all(["A", "B"].map((label) => db.user.create({ data: {
    email: `rfq-seller-${label.toLowerCase()}-${stamp}@example.test`, firstName: "Seller", lastName: label,
    role: "SELLER_OWNER", status: "ACTIVE",
  } })));
  created.users.push(buyer.id, ownerA!.id, ownerB!.id);
  actorAId = ownerA!.id;
  actorBId = ownerB!.id;
  const [sellerA, sellerB] = await Promise.all([
    db.sellerProfile.create({ data: { userId: ownerA!.id, businessNameEn: `RFQ A ${stamp}`, crNumber: `RFQ-A-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
    db.sellerProfile.create({ data: { userId: ownerB!.id, businessNameEn: `RFQ B ${stamp}`, crNumber: `RFQ-B-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
  ]);
  created.sellers.push(sellerA.id, sellerB.id);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;
  const rfq = await db.rFQRequest.create({ data: {
    rfqNumber: `RFQ-CLAIM-${stamp}`, buyerId: buyer.id, status: "SUBMITTED", currency: "AED",
    items: { create: { nameEn: "Shared open item", quantity: 2 } },
  }, include: { items: true } });
  rfqId = rfq.id;
  itemId = rfq.items[0]!.id;
});

afterAll(async () => {
  if (rfqId) {
    await db.auditLog.deleteMany({ where: { entityType: "RFQRequest", entityId: rfqId } });
    await db.rFQRequest.deleteMany({ where: { id: rfqId } });
  }
  await db.sellerProfile.deleteMany({ where: { id: { in: created.sellers } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
});

describe("unassigned RFQ seller claim", () => {
  it("gives concurrent sellers exactly one winner and one truthful audit", async () => {
    const outcomes = await Promise.allSettled([
      submitQuote({ rfqId, sellerId: sellerAId, actorId: actorAId, items: [{ itemId, unitQuoted: 10 }] }),
      submitQuote({ rfqId, sellerId: sellerBId, actorId: actorBId, items: [{ itemId, unitQuoted: 20 }] }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);

    const final = await db.rFQRequest.findUnique({ where: { id: rfqId }, include: { items: true } });
    expect([sellerAId, sellerBId]).toContain(final?.sellerId);
    const winningPrice = final?.sellerId === sellerAId ? 10 : 20;
    expect(Number(final?.totalQuoted)).toBe(winningPrice * 2);
    expect(Number(final?.items[0]?.unitQuoted)).toBe(winningPrice);
    expect(await db.auditLog.count({ where: { entityType: "RFQRequest", entityId: rfqId } })).toBe(1);
  });
});
