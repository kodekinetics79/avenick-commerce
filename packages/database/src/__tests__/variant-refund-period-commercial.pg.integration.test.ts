import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../index";
import { createGovernedPurchaseOrder, placeGovernedPurchaseOrder } from "../services/b2b-purchase-orders";
import { createCustomerReturnRequests } from "../services/customer-returns";
import { secureCreateOrder } from "../services/secure-checkout";
import { setReturnStatus } from "../services/workflow";

const run = process.env["DATABASE_URL"] ? describe.sequential : describe.skip;
const cleanupUsers: string[] = [];
const cleanupCompanies: string[] = [];

afterEach(async () => {
  if (!cleanupUsers.length) return;
  const userIds = cleanupUsers.splice(0);
  const companyIds = cleanupCompanies.splice(0);
  const sellers = await db.sellerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const sellerIds = sellers.map((seller) => seller.id);
  const orders = await db.order.findMany({ where: { OR: [{ userId: { in: userIds } }, { items: { some: { sellerId: { in: sellerIds } } } }] }, select: { id: true } });
  const orderIds = orders.map((order) => order.id);
  const orderItems = await db.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
  await db.orderLinePriceTrace.deleteMany({ where: { orderItemId: { in: orderItems.map((item) => item.id) } } });
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { sellerId: { in: sellerIds } }] } });
  await db.commission.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.purchaseOrder.deleteMany({ where: { requesterId: { in: userIds } } });
  await db.companyMember.deleteMany({ where: { userId: { in: userIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.inventoryStock.deleteMany({ where: { product: { sellerId: { in: sellerIds } } } });
  await db.inventoryLocation.deleteMany({ where: { warehouse: { sellerId: { in: sellerIds } }, stock: { none: {} } } });
  await db.warehouse.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.product.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.category.deleteMany({ where: { products: { none: {} }, slug: { startsWith: "commercial-truth-" } } });
  await db.sellerProfile.deleteMany({ where: { id: { in: sellerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

run("variant and refund commercial truth", () => {
  it("keeps locked approved variant terms when catalog pricing changes after the PO placement claim", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const [requester, owner] = await Promise.all([
      db.user.create({ data: { email: `variant-buyer-${stamp}@example.test`, firstName: "Variant", lastName: "Buyer", role: "COMPANY_BUYER", status: "ACTIVE" } }),
      db.user.create({ data: { email: `variant-owner-${stamp}@example.test`, firstName: "Variant", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
    ]);
    cleanupUsers.push(requester.id, owner.id);
    const seller = await db.sellerProfile.create({ data: {
      userId: owner.id, businessNameEn: `Variant ${stamp}`, crNumber: `VAR-${stamp}`,
      type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE",
    } });
    const company = await db.company.create({ data: {
      nameEn: `Variant company ${stamp}`, industry: "OTHER", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE",
      members: { create: { userId: requester.id, role: "COMPANY_BUYER", isActive: true } },
    } });
    cleanupCompanies.push(company.id);
    const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: `commercial-truth-variant-${stamp}` } });
    const product = await db.product.create({ data: {
      sellerId: seller.id, categoryId: category.id, sku: `BASE-${stamp}`, slug: `variant-commercial-${stamp}`,
      nameEn: "Base SKU", nameAr: "Base SKU", status: "ACTIVE", isB2CEnabled: true, isB2BEnabled: true,
      prices: { create: { type: "B2C", currency: "AED", price: 10, vatRate: 5 } },
      variants: { create: {
        sku: `VARIANT-${stamp}`, nameEn: "Authoritative variant", attributes: {},
        prices: { create: [
          { type: "B2C", currency: "AED", price: 125, vatRate: 0 },
          { type: "B2B", currency: "AED", price: 80, vatRate: 15 },
        ] },
      } },
    }, include: { variants: true } });
    const variant = product.variants[0]!;
    const warehouse = await db.warehouse.create({ data: { sellerId: seller.id, nameEn: stamp, type: "SELLER", country: "AE", city: "Dubai" } });
    const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: `VAR-${stamp}` } });
    await db.inventoryStock.create({ data: { productId: product.id, variantId: variant.id, locationId: location.id, qty: 10 } });

    const b2c = await secureCreateOrder({
      userId: requester.id, type: "B2C", currency: "AED",
      items: [{ productId: product.id, variantId: variant.id, quantity: 1 }], shippingAddress: { country: "AE" },
    });
    expect(Number(b2c.total)).toBe(125);
    const b2cItem = await db.orderItem.findFirstOrThrow({ where: { orderId: b2c.id } });
    expect(b2cItem).toMatchObject({ sku: variant.sku });
    expect(Number(b2cItem.unitPrice)).toBe(125);
    expect(Number(b2cItem.vatAmount)).toBe(0);

    const po = await createGovernedPurchaseOrder({
      companyId: company.id, requesterId: requester.id, currency: "AED",
      items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
    });
    expect(Number(po.total)).toBe(92);
    expect(Number(po.items[0]!.unitPrice)).toBe(80);
    expect(Number(po.items[0]!.vatRate)).toBe(15);
    expect(po.items[0]!.priceExplanation).toMatchObject({ scope: "VARIANT", variantId: variant.id });
    // `pricePOLines` revalidates through the transaction client. The next direct
    // product read is secure checkout after those placement locks are released.
    // Mutate at that exact boundary to deterministically reproduce the former
    // catalog-price TOCTOU rather than relying on scheduler timing.
    const originalFindMany = db.product.findMany.bind(db.product);
    let mutatedAfterClaim = false;
    const productRead = vi.spyOn(db.product, "findMany").mockImplementation((async (...args: unknown[]) => {
      if (!mutatedAfterClaim) {
        mutatedAfterClaim = true;
        await db.productPrice.updateMany({
          where: { variantId: variant.id, type: "B2B", currency: "AED" },
          data: { price: 999, vatRate: 0 },
        });
      }
      return originalFindMany(args[0] as never);
    }) as never);
    let placed;
    try {
      placed = await placeGovernedPurchaseOrder({ purchaseOrderId: po.id, companyId: company.id, actorId: requester.id });
    } finally {
      productRead.mockRestore();
    }
    expect(mutatedAfterClaim).toBe(true);
    const changedPrice = await db.productPrice.findFirstOrThrow({ where: { variantId: variant.id, type: "B2B" } });
    expect(Number(changedPrice.price)).toBe(999);
    expect(Number(placed.total)).toBe(92);
    const placedItem = await db.orderItem.findFirstOrThrow({ where: { orderId: placed.id } });
    expect(Number(placedItem.unitPrice)).toBe(80);
    expect(Number(placedItem.vatAmount)).toBe(12);
  });

  it("uses exact mixed-VAT returned-line facts and recognizes an old sale's refund in the completion period", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const [buyer, actor, ownerA, ownerB] = await Promise.all([
      db.user.create({ data: { email: `refund-buyer-${stamp}@example.test`, firstName: "Refund", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } }),
      db.user.create({ data: { email: `refund-admin-${stamp}@example.test`, firstName: "Refund", lastName: "Admin", role: "ADMIN", status: "ACTIVE" } }),
      db.user.create({ data: { email: `refund-a-${stamp}@example.test`, firstName: "Refund", lastName: "A", role: "SELLER_OWNER", status: "ACTIVE" } }),
      db.user.create({ data: { email: `refund-b-${stamp}@example.test`, firstName: "Refund", lastName: "B", role: "SELLER_OWNER", status: "ACTIVE" } }),
    ]);
    cleanupUsers.push(buyer.id, actor.id, ownerA.id, ownerB.id);
    const [sellerA, sellerB] = await Promise.all([
      db.sellerProfile.create({ data: { userId: ownerA.id, businessNameEn: `Refund A ${stamp}`, crNumber: `RA-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
      db.sellerProfile.create({ data: { userId: ownerB.id, businessNameEn: `Refund B ${stamp}`, crNumber: `RB-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
    ]);
    const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: `commercial-truth-refund-${stamp}` } });
    const [zeroProduct, taxableProduct, otherSellerProduct] = await Promise.all([
      db.product.create({ data: { sellerId: sellerA.id, categoryId: category.id, sku: `ZERO-${stamp}`, slug: `zero-${stamp}`, nameEn: "Discounted zero rate", nameAr: "Zero", status: "ACTIVE" } }),
      db.product.create({ data: { sellerId: sellerA.id, categoryId: category.id, sku: `TAX-${stamp}`, slug: `tax-${stamp}`, nameEn: "Taxable", nameAr: "Tax", status: "ACTIVE" } }),
      db.product.create({ data: { sellerId: sellerB.id, categoryId: category.id, sku: `OTHER-${stamp}`, slug: `other-${stamp}`, nameEn: "Other seller", nameAr: "Other", status: "ACTIVE" } }),
    ]);
    const priorYear = new Date(new Date().getFullYear() - 1, 5, 15);
    const order = await db.order.create({ data: {
      orderNumber: `MIXED-${stamp}`, userId: buyer.id, type: "B2C", status: "DELIVERED", paymentStatus: "PAID",
      currency: "AED", subtotal: 400, discountAmount: 20, vatAmount: 15, total: 395, shippingAddress: {}, createdAt: priorYear,
      items: { create: [
        { productId: zeroProduct.id, sellerId: sellerA.id, sku: zeroProduct.sku, nameEn: zeroProduct.nameEn, nameAr: zeroProduct.nameAr, quantity: 2, unitPrice: 50, vatRate: 0, vatAmount: 0, total: 80, status: "DELIVERED" },
        { productId: taxableProduct.id, sellerId: sellerA.id, sku: taxableProduct.sku, nameEn: taxableProduct.nameEn, nameAr: taxableProduct.nameAr, quantity: 1, unitPrice: 100, vatRate: 5, vatAmount: 5, total: 105, status: "DELIVERED" },
        { productId: otherSellerProduct.id, sellerId: sellerB.id, sku: otherSellerProduct.sku, nameEn: otherSellerProduct.nameEn, nameAr: otherSellerProduct.nameAr, quantity: 2, unitPrice: 100, vatRate: 5, vatAmount: 10, total: 210, status: "DELIVERED" },
      ] },
      commissions: { create: [
        { sellerId: sellerA.id, amount: 9, rate: 5, currency: "AED", createdAt: priorYear },
        { sellerId: sellerB.id, amount: 10, rate: 5, currency: "AED", createdAt: priorYear },
      ] },
    }, include: { items: true } });
    const zeroItem = order.items.find((item) => item.productId === zeroProduct.id)!;
    const otherItem = order.items.find((item) => item.productId === otherSellerProduct.id)!;
    const returns = await createCustomerReturnRequests({
      userId: buyer.id, orderId: order.id, reason: "Mixed VAT partial return",
      selections: [{ orderItemId: zeroItem.id, quantity: 1 }, { orderItemId: otherItem.id, quantity: 1 }],
    });
    expect(returns).toHaveLength(2);
    for (const ret of returns) {
      await setReturnStatus({ returnId: ret.id, status: "APPROVED", actorId: actor.id });
      if (ret.sellerId === sellerA.id) {
        await expect(setReturnStatus({
          returnId: ret.id, status: "REFUNDED", actorId: actor.id,
          refundAmount: Number(ret.refundAmount) - 1, refundReference: `WRONG-${ret.id}`,
        })).rejects.toThrow(/exact selected line quantities/i);
      }
      await setReturnStatus({ returnId: ret.id, status: "REFUNDED", actorId: actor.id, refundReference: `MIXED-${ret.id}` });
    }
    const refundA = await db.refund.findFirstOrThrow({ where: { returnRequest: { sellerId: sellerA.id } } });
    const refundB = await db.refund.findFirstOrThrow({ where: { returnRequest: { sellerId: sellerB.id } } });
    expect([Number(refundA.amount), Number(refundA.netAmount), Number(refundA.vatAmount)]).toEqual([40, 40, 0]);
    expect([Number(refundB.amount), Number(refundB.netAmount), Number(refundB.vatAmount)]).toEqual([105, 100, 5]);
    const reversals = await db.commission.findMany({ where: { orderId: order.id, amount: { lt: 0 } }, orderBy: { sellerId: "asc" } });
    expect(reversals.map((row) => Number(row.amount)).sort((a, b) => a - b)).toEqual([-5, -2]);
    const snapshots = await db.returnRequestItem.findMany({ where: { returnRequestId: { in: returns.map((ret) => ret.id) } } });
    expect(snapshots.reduce((sum, row) => sum + Number(row.vatAmount), 0)).toBe(5);

    // The sale belongs to a prior year while all three reversals are current-period
    // ledger entries. Avoid asserting global dashboard totals here: PG suites run
    // concurrently and legitimately mutate those totals.
    expect(order.createdAt.getFullYear()).toBe(new Date().getFullYear() - 1);
    expect([refundA, refundB].every((refund) =>
      refund.processedAt?.getFullYear() === new Date().getFullYear(),
    )).toBe(true);
    expect(reversals.every((row) => row.createdAt.getFullYear() === new Date().getFullYear())).toBe(true);
    const [periodLedger] = await db.$queryRaw<Array<{ gross: number; vat: number }>>`
      SELECT SUM(amount)::float AS gross, SUM("vatAmount")::float AS vat
      FROM "Refund"
      WHERE "orderId" = ${order.id}
        AND status = 'COMPLETED'
        AND date_trunc('month', COALESCE("processedAt", "createdAt")) = date_trunc('month', CURRENT_TIMESTAMP)
    `;
    expect(periodLedger).toEqual({ gross: 145, vat: 5 });
  });
});
