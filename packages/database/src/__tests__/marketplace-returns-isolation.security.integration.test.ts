import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { setReturnStatus } from "../services/workflow";
import { getFinanceOverview } from "../services/finance";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const ids = { users: [] as string[], sellers: [] as string[], products: [] as string[], returns: [] as string[] };
let orderId = "";
let categoryId = "";
let actorId = "";
let sellerOneId = "";
let sellerTwoId = "";
let payoutId = "";

beforeAll(async () => {
  const buyer = await db.user.create({ data: { email: `returns-buyer-${stamp}@example.test`, firstName: "Return", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } });
  const ownerOne = await db.user.create({ data: { email: `returns-one-${stamp}@example.test`, firstName: "Seller", lastName: "One", role: "SELLER_OWNER", status: "ACTIVE" } });
  const ownerTwo = await db.user.create({ data: { email: `returns-two-${stamp}@example.test`, firstName: "Seller", lastName: "Two", role: "SELLER_OWNER", status: "ACTIVE" } });
  ids.users.push(buyer.id, ownerOne.id, ownerTwo.id);
  actorId = ownerOne.id;

  const sellerOne = await db.sellerProfile.create({ data: { userId: ownerOne.id, businessNameEn: `Returns One ${stamp}`, crNumber: `RET1-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } });
  const sellerTwo = await db.sellerProfile.create({ data: { userId: ownerTwo.id, businessNameEn: `Returns Two ${stamp}`, crNumber: `RET2-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } });
  ids.sellers.push(sellerOne.id, sellerTwo.id);
  sellerOneId = sellerOne.id;
  sellerTwoId = sellerTwo.id;

  const category = await db.category.create({ data: { nameEn: `Returns ${stamp}`, nameAr: `Returns ${stamp}`, slug: `returns-${stamp}` } });
  categoryId = category.id;
  const productOne = await db.product.create({ data: { sellerId: sellerOne.id, categoryId, sku: `RET-P1-${stamp}`, slug: `ret-p1-${stamp}`, nameEn: "Seller one line", nameAr: "Seller one line", status: "ACTIVE" } });
  const productTwo = await db.product.create({ data: { sellerId: sellerTwo.id, categoryId, sku: `RET-P2-${stamp}`, slug: `ret-p2-${stamp}`, nameEn: "Seller two line", nameAr: "Seller two line", status: "ACTIVE" } });
  ids.products.push(productOne.id, productTwo.id);

  const order = await db.order.create({
    data: {
      orderNumber: `RET-ORDER-${stamp}`,
      userId: buyer.id,
      type: "B2C",
      status: "DELIVERED",
      paymentStatus: "PAID",
      currency: "AED",
      subtotal: 300,
      vatAmount: 15,
      total: 315,
      shippingAddress: { line1: "Test", city: "Dubai", country: "AE" },
      items: { create: [
        { productId: productOne.id, sellerId: sellerOne.id, sku: productOne.sku, nameEn: productOne.nameEn, nameAr: productOne.nameAr, quantity: 1, unitPrice: 100, vatAmount: 5, total: 105, status: "DELIVERED" },
        { productId: productTwo.id, sellerId: sellerTwo.id, sku: productTwo.sku, nameEn: productTwo.nameEn, nameAr: productTwo.nameAr, quantity: 1, unitPrice: 200, vatAmount: 10, total: 210, status: "DELIVERED" },
      ] },
    },
  });
  orderId = order.id;
  await db.commission.create({ data: { sellerId: sellerOne.id, orderId, amount: 5, rate: 5, currency: "AED" } });
  const payout = await db.sellerPayout.create({ data: {
    sellerId: sellerOne.id, amount: 100, currency: "AED", status: "PENDING",
    periodFrom: new Date("2026-01-01"), periodTo: new Date("2026-01-31"),
    items: { create: { orderId, amount: 105, commission: 5, net: 100 } },
  } });
  payoutId = payout.id;

  const returns = await Promise.all([
    db.returnRequest.create({ data: { returnNumber: `RET-A-${stamp}`, orderId, sellerId: sellerOne.id, reason: "test", status: "RECEIVED" } }),
    db.returnRequest.create({ data: { returnNumber: `RET-B-${stamp}`, orderId, sellerId: sellerTwo.id, reason: "test", status: "RECEIVED" } }),
  ]);
  ids.returns.push(...returns.map((entry) => entry.id));
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { entityType: "ReturnRequest", entityId: { in: ids.returns } } });
  if (payoutId) await db.sellerPayout.deleteMany({ where: { id: payoutId } });
  if (orderId) await db.commission.deleteMany({ where: { orderId } });
  if (orderId) await db.order.deleteMany({ where: { id: orderId } });
  await db.product.deleteMany({ where: { id: { in: ids.products } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerProfile.deleteMany({ where: { id: { in: ids.sellers } } });
  await db.user.deleteMany({ where: { id: { in: ids.users } } });
});

describe("marketplace return isolation", () => {
  it("caps a return to the target seller's own lines", async () => {
    const before = await getFinanceOverview();
    const result = await setReturnStatus({ returnId: ids.returns[0]!, status: "REFUNDED", actorId });
    expect(Number(result.refundAmount)).toBe(105);
    const refund = await db.refund.findFirst({ where: { orderId, reason: { contains: ids.returns[0]! } } });
    expect(Number(refund?.amount)).toBe(105);
    expect(refund?.status).toBe("COMPLETED");
    const commissions = await db.commission.aggregate({ where: { orderId, sellerId: sellerOneId }, _sum: { amount: true } });
    expect(Number(commissions._sum.amount)).toBe(0);
    const payout = await db.sellerPayout.findUniqueOrThrow({ where: { id: payoutId }, include: { items: true } });
    expect(Number(payout.amount)).toBe(0);
    expect(Number(payout.items[0]!.net)).toBe(0);
    const after = await getFinanceOverview();
    expect(after.gmvMonth).toBeCloseTo(before.gmvMonth - 105, 2);
    expect(after.vatCollectedYear).toBeCloseTo(before.vatCollectedYear - 5, 2);
    expect(after.commissionMonth).toBeCloseTo(before.commissionMonth - 5, 2);
    expect(after.pendingPayoutAmount).toBeCloseTo(before.pendingPayoutAmount - 100, 2);
    expect(sellerOneId).not.toBe(sellerTwoId);
  });

  it("serializes concurrent refund attempts and creates exactly one refund", async () => {
    const returnId = ids.returns[1]!;
    const outcomes = await Promise.allSettled([
      setReturnStatus({ returnId, status: "REFUNDED", actorId }),
      setReturnStatus({ returnId, status: "REFUNDED", actorId }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(await db.refund.count({ where: { orderId, reason: { contains: returnId } } })).toBe(1);
    const updated = await db.returnRequest.findUnique({ where: { id: returnId } });
    expect(Number(updated?.refundAmount)).toBe(210);
  });
});
