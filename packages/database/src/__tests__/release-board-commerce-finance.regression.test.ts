import { describe, expect, it } from "vitest";
import { db } from "../index";
import { canonicalOrderRequest } from "../services/commerce-governance";
import { getProductBySlug } from "../services/products";
import { setPayoutStatus } from "../services/finance";
import {
  createGovernedApprovalPolicy,
  createGovernedPurchaseOrder,
  placeGovernedPurchaseOrder,
} from "../services/b2b-purchase-orders";

describe("release-board data minimization", () => {
  it("stores an opaque stable checkout digest, never canonical request PII", () => {
    const request = {
      items: [{ productId: "product", quantity: 1 }],
      shippingAddress: { line1: "Private villa 12", city: "Dubai", country: "AE" },
      notes: "Call my private mobile",
      paymentMethod: "BANK_TRANSFER" as const,
      currency: "AED" as const,
      type: "B2C" as const,
    };
    const digest = canonicalOrderRequest(request);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain("Private villa");
    expect(digest).toBe(canonicalOrderRequest(request));
  });
});

describe.skipIf(!process.env["DATABASE_URL"])("release-board commerce/finance PostgreSQL invariants", () => {
  it("never exposes cross-channel variant prices or inventory topology", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const owner = await db.user.create({ data: {
      email: `privacy-${stamp}@example.test`, firstName: "Privacy", lastName: "Owner",
      role: "SELLER_OWNER", status: "ACTIVE",
    } });
    const seller = await db.sellerProfile.create({ data: {
      userId: owner.id, businessNameEn: `Privacy ${stamp}`, crNumber: `PRIV-${stamp}`,
      type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE",
    } });
    const category = await db.category.create({ data: { nameEn: `Privacy ${stamp}`, nameAr: "Privacy", slug: `privacy-${stamp}` } });
    const product = await db.product.create({ data: {
      sellerId: seller.id, categoryId: category.id, sku: `PRIV-${stamp}`, slug: `privacy-product-${stamp}`,
      nameEn: "Private topology", nameAr: "Private topology", status: "ACTIVE",
      prices: { create: [
        { type: "B2C", currency: "AED", price: 100 },
        { type: "B2B", currency: "AED", price: 70 },
      ] },
      variants: { create: { sku: `PRIV-V-${stamp}`, nameEn: "Variant", attributes: {}, prices: { create: [
        { type: "B2C", currency: "AED", price: 110 },
        { type: "B2B", currency: "AED", price: 75 },
      ] } } },
    }, include: { variants: true } });
    const warehouse = await db.warehouse.create({ data: {
      sellerId: seller.id, nameEn: `Secret warehouse ${stamp}`, type: "SELLER", country: "AE", city: "Dubai",
    } });
    const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: `SECRET-BIN-${stamp}` } });
    await db.inventoryStock.create({ data: {
      productId: product.id, variantId: product.variants[0]!.id, locationId: location.id,
      qty: 19, reservedQty: 4, reorderPoint: 17,
    } });
    try {
      const publicProduct = await getProductBySlug(product.slug, "B2C", "AED");
      expect(publicProduct?.prices.map((price) => price.type)).toEqual(["B2C"]);
      expect(publicProduct?.variants[0]?.prices.map((price) => price.type)).toEqual(["B2C"]);
      expect(publicProduct?.inventory).toEqual([{ variantId: product.variants[0]!.id, available: 15 }]);
      expect(JSON.stringify(publicProduct)).not.toContain("Secret warehouse");
      expect(JSON.stringify(publicProduct)).not.toContain("SECRET-BIN");
      expect(JSON.stringify(publicProduct)).not.toContain("reorderPoint");
    } finally {
      await db.inventoryStock.deleteMany({ where: { productId: product.id } });
      await db.inventoryLocation.deleteMany({ where: { warehouseId: warehouse.id } });
      await db.warehouse.delete({ where: { id: warehouse.id } });
      await db.product.delete({ where: { id: product.id } });
      await db.category.delete({ where: { id: category.id } });
      await db.sellerProfile.delete({ where: { id: seller.id } });
      await db.user.delete({ where: { id: owner.id } });
    }
  });

  it("serializes competing terminal payout decisions and requires settlement evidence", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const [actor, owner] = await Promise.all([
      db.user.create({ data: { email: `payout-actor-${stamp}@example.test`, firstName: "Payout", lastName: "Admin", role: "ADMIN", status: "ACTIVE" } }),
      db.user.create({ data: { email: `payout-owner-${stamp}@example.test`, firstName: "Payout", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
    ]);
    const seller = await db.sellerProfile.create({ data: {
      userId: owner.id, businessNameEn: `Payout ${stamp}`, crNumber: `PAY-${stamp}`,
      type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE",
    } });
    const payout = await db.sellerPayout.create({ data: {
      sellerId: seller.id, amount: 100, currency: "AED", status: "PROCESSING",
      periodFrom: new Date("2026-01-01"), periodTo: new Date("2026-01-31"),
    } });
    try {
      await expect(setPayoutStatus({ payoutId: payout.id, status: "PAID", actorId: actor.id }))
        .rejects.toThrow(/settlement reference/i);
      const outcomes = await Promise.allSettled([
        setPayoutStatus({ payoutId: payout.id, status: "PAID", actorId: actor.id, reference: `BANK-${stamp}` }),
        setPayoutStatus({ payoutId: payout.id, status: "FAILED", actorId: actor.id }),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(await db.auditLog.count({ where: { entityType: "SellerPayout", entityId: payout.id } })).toBe(1);
    } finally {
      await db.auditLog.deleteMany({ where: { entityType: "SellerPayout", entityId: payout.id } });
      await db.sellerPayout.delete({ where: { id: payout.id } });
      await db.sellerProfile.delete({ where: { id: seller.id } });
      await db.user.deleteMany({ where: { id: { in: [actor.id, owner.id] } } });
    }
  });

  it("linearizes governed placement against a concurrent policy mutation", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const requester = await db.user.create({ data: {
      email: `po-requester-${stamp}@example.test`, firstName: "PO", lastName: "Requester",
      role: "COMPANY_BUYER", status: "ACTIVE",
    } });
    const sellerOwner = await db.user.create({ data: {
      email: `po-seller-${stamp}@example.test`, firstName: "PO", lastName: "Seller",
      role: "SELLER_OWNER", status: "ACTIVE",
    } });
    const seller = await db.sellerProfile.create({ data: {
      userId: sellerOwner.id, businessNameEn: `PO Seller ${stamp}`, crNumber: `PO-S-${stamp}`,
      type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE",
    } });
    const company = await db.company.create({ data: {
      nameEn: `PO Company ${stamp}`, industry: "OTHER", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE",
      members: { create: { userId: requester.id, role: "COMPANY_BUYER", isActive: true } },
    } });
    const category = await db.category.create({ data: { nameEn: `PO ${stamp}`, nameAr: "PO", slug: `po-${stamp}` } });
    const product = await db.product.create({ data: {
      sellerId: seller.id, categoryId: category.id, sku: `PO-P-${stamp}`, slug: `po-product-${stamp}`,
      nameEn: "Governed product", nameAr: "Governed product", status: "ACTIVE", isB2BEnabled: true,
      prices: { create: { type: "B2B", currency: "AED", price: 100, vatRate: 5 } },
    } });
    const warehouse = await db.warehouse.create({ data: {
      sellerId: seller.id, nameEn: `PO warehouse ${stamp}`, type: "SELLER", country: "AE", city: "Dubai",
    } });
    const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: `PO-${stamp}` } });
    await db.inventoryStock.create({ data: { productId: product.id, variantId: null, locationId: location.id, qty: 10 } });
    const po = await createGovernedPurchaseOrder({
      companyId: company.id, requesterId: requester.id, currency: "AED", items: [{ productId: product.id, quantity: 1 }],
    });
    try {
      expect(po.status).toBe("APPROVED");
      await Promise.allSettled([
        placeGovernedPurchaseOrder({ purchaseOrderId: po.id, companyId: company.id, actorId: requester.id }),
        createGovernedApprovalPolicy({
          companyId: company.id, actorId: requester.id, name: `Concurrent ${stamp}`,
          thresholdAmount: 1, currency: "AED", approverRole: "COMPANY_APPROVER",
        }),
      ]);
      const [finalPO, linkedOrder] = await Promise.all([
        db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } }),
        db.order.findFirst({ where: { purchaseOrderId: po.id } }),
      ]);
      expect(linkedOrder ? finalPO.status === "ORDERED" : finalPO.status === "PENDING_APPROVAL").toBe(true);
      expect(finalPO.status === "PENDING_APPROVAL" && linkedOrder !== null).toBe(false);
    } finally {
      await db.auditLog.deleteMany({ where: { OR: [{ entityId: po.id }, { actorId: requester.id }] } });
      await db.order.deleteMany({ where: { purchaseOrderId: po.id } });
      await db.purchaseOrder.delete({ where: { id: po.id } });
      await db.approvalPolicy.deleteMany({ where: { companyId: company.id } });
      await db.companyMember.deleteMany({ where: { companyId: company.id } });
      await db.inventoryStock.deleteMany({ where: { productId: product.id } });
      await db.inventoryLocation.deleteMany({ where: { warehouseId: warehouse.id } });
      await db.warehouse.delete({ where: { id: warehouse.id } });
      await db.product.delete({ where: { id: product.id } });
      await db.category.delete({ where: { id: category.id } });
      await db.company.delete({ where: { id: company.id } });
      await db.sellerProfile.delete({ where: { id: seller.id } });
      await db.user.deleteMany({ where: { id: { in: [requester.id, sellerOwner.id] } } });
    }
  });
});
