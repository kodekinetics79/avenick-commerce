import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { submitQuote } from "../services/rfq";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const created = { users: [] as string[], sellers: [] as string[] };
const rfqIds: string[] = [];
let buyerId = "";
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
  buyerId = buyer.id;
  actorAId = ownerA!.id;
  actorBId = ownerB!.id;
  const [sellerA, sellerB] = await Promise.all([
    db.sellerProfile.create({ data: { userId: ownerA!.id, businessNameEn: `RFQ A ${stamp}`, crNumber: `RFQ-A-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
    db.sellerProfile.create({ data: { userId: ownerB!.id, businessNameEn: `RFQ B ${stamp}`, crNumber: `RFQ-B-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
  ]);
  created.sellers.push(sellerA.id, sellerB.id);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;
});

afterAll(async () => {
  if (rfqIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityType: "RFQRequest", entityId: { in: rfqIds } } });
    await db.rFQRequest.deleteMany({ where: { id: { in: rfqIds } } });
  }
  await db.sellerProfile.deleteMany({ where: { id: { in: created.sellers } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
});

async function createOpenRfq(label: string) {
  const rfq = await db.rFQRequest.create({
    data: {
      rfqNumber: `RFQ-${label}-${stamp}`,
      buyerId,
      status: "SUBMITTED",
      currency: "AED",
      items: {
        create: [
          { nameEn: "First shared item", quantity: 2 },
          { nameEn: "Second shared item", quantity: 3 },
        ],
      },
    },
    include: { items: { orderBy: { nameEn: "asc" } } },
  });
  rfqIds.push(rfq.id);
  return rfq;
}

describe("unassigned RFQ seller claim", () => {
  it("rejects duplicate item ids without claiming or partially quoting the RFQ", async () => {
    const rfq = await createOpenRfq("DUPLICATE");
    const firstItemId = rfq.items[0]!.id;

    await expect(submitQuote({
      rfqId: rfq.id,
      sellerId: sellerAId,
      actorId: actorAId,
      items: [
        { itemId: firstItemId, unitQuoted: 10 },
        { itemId: firstItemId, unitQuoted: 20 },
      ],
    })).rejects.toThrow(/each RFQ item exactly once/);

    const unchanged = await db.rFQRequest.findUniqueOrThrow({
      where: { id: rfq.id },
      include: { items: true },
    });
    expect(unchanged).toMatchObject({ sellerId: null, status: "SUBMITTED", totalQuoted: null });
    expect(unchanged.items.every((item) => item.unitQuoted === null)).toBe(true);
    expect(await db.auditLog.count({ where: { entityType: "RFQRequest", entityId: rfq.id } })).toBe(0);
  });

  it("rejects an omitted item without claiming or partially quoting the RFQ", async () => {
    const rfq = await createOpenRfq("OMITTED");

    await expect(submitQuote({
      rfqId: rfq.id,
      sellerId: sellerAId,
      actorId: actorAId,
      items: [{ itemId: rfq.items[0]!.id, unitQuoted: 10 }],
    })).rejects.toThrow(/each RFQ item exactly once/);

    const unchanged = await db.rFQRequest.findUniqueOrThrow({
      where: { id: rfq.id },
      include: { items: true },
    });
    expect(unchanged).toMatchObject({ sellerId: null, status: "SUBMITTED", totalQuoted: null });
    expect(unchanged.items.every((item) => item.unitQuoted === null)).toBe(true);
    expect(await db.auditLog.count({ where: { entityType: "RFQRequest", entityId: rfq.id } })).toBe(0);
  });

  it("gives concurrent sellers exactly one winner and one truthful audit", async () => {
    const rfq = await createOpenRfq("CLAIM");
    const [firstItem, secondItem] = rfq.items;
    const outcomes = await Promise.allSettled([
      submitQuote({
        rfqId: rfq.id,
        sellerId: sellerAId,
        actorId: actorAId,
        items: [
          { itemId: firstItem!.id, unitQuoted: 10 },
          { itemId: secondItem!.id, unitQuoted: 5 },
        ],
      }),
      submitQuote({
        rfqId: rfq.id,
        sellerId: sellerBId,
        actorId: actorBId,
        items: [
          { itemId: firstItem!.id, unitQuoted: 20 },
          { itemId: secondItem!.id, unitQuoted: 8 },
        ],
      }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);

    const final = await db.rFQRequest.findUnique({ where: { id: rfq.id }, include: { items: true } });
    expect([sellerAId, sellerBId]).toContain(final?.sellerId);
    const expectedPrices = final?.sellerId === sellerAId ? [10, 5] : [20, 8];
    expect(Number(final?.totalQuoted)).toBe(expectedPrices[0]! * 2 + expectedPrices[1]! * 3);
    const pricesById = new Map(final?.items.map((item) => [item.id, Number(item.unitQuoted)]));
    expect(pricesById.get(firstItem!.id)).toBe(expectedPrices[0]);
    expect(pricesById.get(secondItem!.id)).toBe(expectedPrices[1]);
    expect(await db.auditLog.count({ where: { entityType: "RFQRequest", entityId: rfq.id } })).toBe(1);
  });
});
