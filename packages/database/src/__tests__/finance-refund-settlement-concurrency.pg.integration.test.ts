import { afterEach, describe, expect, it } from "vitest";
import { db } from "../index";
import { getSellerFinancialPosition, setPayoutStatus } from "../services/finance";
import { setReturnStatus } from "../services/workflow";

const run = process.env["DATABASE_URL"] ? describe : describe.skip;
const cleanupUsers: string[] = [];

async function fixture(label: string, payouts: Array<{ status: "PENDING" | "PROCESSING" | "PAID"; gross: number; commission: number }>) {
  const stamp = `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const [buyer, owner, actor] = await Promise.all([
    db.user.create({ data: { email: `refund-buyer-${stamp}@example.test`, firstName: "Refund", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `refund-owner-${stamp}@example.test`, firstName: "Refund", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `refund-admin-${stamp}@example.test`, firstName: "Refund", lastName: "Admin", role: "ADMIN", status: "ACTIVE" } }),
  ]);
  cleanupUsers.push(buyer.id, owner.id, actor.id);
  const seller = await db.sellerProfile.create({ data: {
    userId: owner.id, businessNameEn: `Refund ${stamp}`, crNumber: `REF-${stamp}`,
    type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE",
  } });
  const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: `refund-${stamp}` } });
  const product = await db.product.create({ data: {
    sellerId: seller.id, categoryId: category.id, sku: `REF-P-${stamp}`, slug: `refund-product-${stamp}`,
    nameEn: "Refund product", nameAr: "Refund product", status: "ACTIVE",
  } });
  const order = await db.order.create({ data: {
    orderNumber: `REF-ORDER-${stamp}`, userId: buyer.id, type: "B2C", status: "DELIVERED", paymentStatus: "PAID",
    currency: "AED", subtotal: 100, vatAmount: 5, total: 105, shippingAddress: {},
    items: { create: { productId: product.id, sellerId: seller.id, sku: product.sku, nameEn: product.nameEn,
      nameAr: product.nameAr, quantity: 1, unitPrice: 100, vatRate: 5, vatAmount: 5, total: 105, status: "DELIVERED" } },
    commissions: { create: { sellerId: seller.id, amount: 5, rate: 5, currency: "AED" } },
  } });
  const createdPayouts = [];
  for (const [index, input] of payouts.entries()) {
    createdPayouts.push(await db.sellerPayout.create({ data: {
      sellerId: seller.id, amount: input.gross - input.commission, currency: "AED", status: input.status,
      reference: input.status === "PAID" ? `BANK-${stamp}-${index}` : null,
      processedAt: input.status === "PAID" ? new Date() : null,
      periodFrom: new Date("2026-01-01"), periodTo: new Date("2026-01-31"),
      items: { create: { orderId: order.id, amount: input.gross, commission: input.commission, net: input.gross - input.commission } },
    } }));
  }
  const ret = await db.returnRequest.create({ data: {
    returnNumber: `RET-${stamp}`, orderId: order.id, sellerId: seller.id, reason: "completed refund", status: "RECEIVED",
  } });
  return { stamp, buyer, owner, actor, seller, category, product, order, payouts: createdPayouts, ret };
}

afterEach(async () => {
  if (!cleanupUsers.length) return;
  const users = cleanupUsers.splice(0);
  const orders = await db.order.findMany({ where: { userId: { in: users } }, select: { id: true } });
  const orderIds = orders.map((row) => row.id);
  await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await db.sellerPayout.deleteMany({ where: { seller: { userId: { in: users } } } });
  await db.commission.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.sellerFinancialAdjustment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.product.deleteMany({ where: { seller: { userId: { in: users } } } });
  await db.category.deleteMany({ where: { slug: { startsWith: "refund-" }, products: { none: {} } } });
  await db.sellerProfile.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
});

run("seller refund/settlement ledger invariants", () => {
  it("keeps PAID cash evidence immutable and records an open seller clawback", async () => {
    const f = await fixture("paid", [{ status: "PAID", gross: 105, commission: 5 }]);
    await expect(setReturnStatus({ returnId: f.ret.id, status: "REFUNDED", actorId: f.actor.id }))
      .rejects.toThrow(/refund reference/i);
    await setReturnStatus({
      returnId: f.ret.id, status: "REFUNDED", actorId: f.actor.id,
      refundReference: `GATEWAY-REFUND-${f.stamp}`,
    });
    const payout = await db.sellerPayout.findUniqueOrThrow({ where: { id: f.payouts[0]!.id }, include: { items: true } });
    expect(payout).toMatchObject({ status: "PAID" });
    expect(Number(payout.amount)).toBe(100);
    expect(Number(payout.items[0]!.net)).toBe(100);
    const adjustment = await db.sellerFinancialAdjustment.findFirstOrThrow({ where: { orderId: f.order.id } });
    expect(adjustment).toMatchObject({ sellerId: f.seller.id, status: "OPEN" });
    expect(Number(adjustment.amount)).toBe(-100);
    await expect(getSellerFinancialPosition(f.seller.id)).resolves.toMatchObject({
      payableAmount: 0, receivableAmount: 100, netSettlementPosition: -100,
    });
    const refund = await db.refund.findFirstOrThrow({ where: { orderId: f.order.id } });
    expect(refund.gatewayRef).toBe(`GATEWAY-REFUND-${f.stamp}`);
  });

  it("linearizes a refund racing settlement without losing the seller receivable", async () => {
    const f = await fixture("race", [{ status: "PROCESSING", gross: 105, commission: 5 }]);
    const results = await Promise.allSettled([
      setPayoutStatus({ payoutId: f.payouts[0]!.id, status: "PAID", actorId: f.actor.id, reference: `BANK-${f.stamp}` }),
      setReturnStatus({ returnId: f.ret.id, status: "REFUNDED", actorId: f.actor.id, refundReference: `REFUND-${f.stamp}` }),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const payout = await db.sellerPayout.findUniqueOrThrow({ where: { id: f.payouts[0]!.id } });
    const open = await db.sellerFinancialAdjustment.aggregate({ where: { orderId: f.order.id, status: "OPEN" }, _sum: { amount: true } });
    expect(payout.status).toBe("PAID");
    expect(Number(payout.amount) + Number(open._sum.amount ?? 0)).toBe(0);
  });

  it("allocates one refund across split unpaid payout items exactly once", async () => {
    const f = await fixture("split", [
      { status: "PENDING", gross: 60, commission: 3 },
      { status: "PROCESSING", gross: 45, commission: 2 },
    ]);
    await setReturnStatus({ returnId: f.ret.id, status: "REFUNDED", actorId: f.actor.id, refundReference: `REFUND-${f.stamp}` });
    const payouts = await db.sellerPayout.findMany({ where: { id: { in: f.payouts.map((row) => row.id) } }, include: { items: true } });
    expect(payouts.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(0);
    expect(payouts.flatMap((row) => row.items).reduce((sum, row) => sum + Number(row.net), 0)).toBe(0);
    expect(await db.sellerFinancialAdjustment.count({ where: { orderId: f.order.id } })).toBe(0);
  });
});
