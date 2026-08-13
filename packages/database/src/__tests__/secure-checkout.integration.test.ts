import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { secureCreateOrder } from "../services/secure-checkout";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
let buyerId = "";
let sellerOwnerId = "";
let attackerOwnerId = "";
let sellerId = "";
let attackerSellerId = "";
let categoryId = "";
let productId = "";
let inactiveProductId = "";
let secondProductId = "";
let foreignVariantId = "";
let warehouseId = "";
let locationId = "";
let stockId = "";
const createdOrderIds: string[] = [];

beforeAll(async () => {
  const buyer = await db.user.create({
    data: {
      email: `secure-buyer-${stamp}@example.test`,
      firstName: "Secure",
      lastName: "Buyer",
      role: "CONSUMER",
      status: "ACTIVE",
    },
  });
  buyerId = buyer.id;

  const sellerOwner = await db.user.create({
    data: {
      email: `secure-seller-${stamp}@example.test`,
      firstName: "Secure",
      lastName: "Seller",
      role: "SELLER_OWNER",
      status: "ACTIVE",
    },
  });
  sellerOwnerId = sellerOwner.id;

  const attackerOwner = await db.user.create({
    data: {
      email: `secure-attacker-${stamp}@example.test`,
      firstName: "Other",
      lastName: "Seller",
      role: "SELLER_OWNER",
      status: "ACTIVE",
    },
  });
  attackerOwnerId = attackerOwner.id;

  const seller = await db.sellerProfile.create({
    data: {
      userId: sellerOwnerId,
      businessNameEn: `Secure Seller ${stamp}`,
      crNumber: `SEC-${stamp}`,
      type: "DISTRIBUTOR",
      country: "AE",
      city: "Dubai",
      status: "ACTIVE",
    },
  });
  sellerId = seller.id;

  const attackerSeller = await db.sellerProfile.create({
    data: {
      userId: attackerOwnerId,
      businessNameEn: `Attacker Seller ${stamp}`,
      crNumber: `ATK-${stamp}`,
      type: "DISTRIBUTOR",
      country: "AE",
      city: "Dubai",
      status: "ACTIVE",
    },
  });
  attackerSellerId = attackerSeller.id;

  const category = await db.category.create({
    data: {
      nameEn: `Checkout Test ${stamp}`,
      nameAr: `Checkout Test ${stamp}`,
      slug: `checkout-test-${stamp}`,
    },
  });
  categoryId = category.id;

  const product = await db.product.create({
    data: {
      sellerId,
      categoryId,
      sku: `SEC-${stamp}`,
      slug: `secure-product-${stamp}`,
      nameEn: "Secure Checkout Product",
      nameAr: "Secure Checkout Product",
      status: "ACTIVE",
      isB2CEnabled: true,
      isB2BEnabled: true,
      prices: {
        create: { type: "B2C", currency: "AED", minQty: 1, price: 100, vatRate: 5 },
      },
    },
  });
  productId = product.id;

  const inactive = await db.product.create({
    data: {
      sellerId,
      categoryId,
      sku: `INACTIVE-${stamp}`,
      slug: `inactive-product-${stamp}`,
      nameEn: "Inactive Product",
      nameAr: "Inactive Product",
      status: "INACTIVE",
      isB2CEnabled: true,
    },
  });
  inactiveProductId = inactive.id;

  const second = await db.product.create({
    data: {
      sellerId,
      categoryId,
      sku: `SECOND-${stamp}`,
      slug: `second-product-${stamp}`,
      nameEn: "Second Product",
      nameAr: "Second Product",
      status: "ACTIVE",
      isB2CEnabled: true,
      variants: {
        create: {
          sku: `SECOND-V-${stamp}`,
          nameEn: "Foreign Variant",
          attributes: { size: "foreign" },
        },
      },
    },
    include: { variants: true },
  });
  secondProductId = second.id;
  foreignVariantId = second.variants[0]!.id;

  const warehouse = await db.warehouse.create({
    data: {
      sellerId,
      nameEn: `Secure Warehouse ${stamp}`,
      type: "SELLER",
      country: "AE",
      city: "Dubai",
    },
  });
  warehouseId = warehouse.id;
  const location = await db.inventoryLocation.create({
    data: { warehouseId, code: `A-${stamp}` },
  });
  locationId = location.id;
  const stock = await db.inventoryStock.create({
    data: { productId, locationId, qty: 25, reservedQty: 0 },
  });
  stockId = stock.id;
});

afterAll(async () => {
  if (createdOrderIds.length) {
    await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  if (stockId) await db.inventoryStock.deleteMany({ where: { id: stockId } });
  if (locationId) await db.inventoryLocation.deleteMany({ where: { id: locationId } });
  if (warehouseId) await db.warehouse.deleteMany({ where: { id: warehouseId } });
  if (productId || inactiveProductId || secondProductId) {
    await db.product.deleteMany({ where: { id: { in: [productId, inactiveProductId, secondProductId].filter(Boolean) } } });
  }
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  if (sellerId || attackerSellerId) {
    await db.sellerProfile.deleteMany({ where: { id: { in: [sellerId, attackerSellerId].filter(Boolean) } } });
  }
  if (buyerId || sellerOwnerId || attackerOwnerId) {
    await db.user.deleteMany({ where: { id: { in: [buyerId, sellerOwnerId, attackerOwnerId].filter(Boolean) } } });
  }
});

describe("secureCreateOrder", () => {
  it("ignores a forged sellerId and persists the product's authoritative seller", async () => {
    const order = await secureCreateOrder({
      userId: buyerId,
      type: "B2C",
      currency: "AED",
      items: [
        // Runtime callers can still send extra JSON keys. The trust boundary must
        // ignore them even if TypeScript has already prevented normal callers.
        { productId, quantity: 2, sellerId: attackerSellerId } as never,
      ],
      shippingAddress: { label: "Office", line1: "1 Test Street", city: "Dubai", country: "AE" },
      paymentMethod: "MOCK",
      idempotencyKey: `secure-${stamp}`,
    });
    createdOrderIds.push(order.id);

    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.sellerId).toBe(sellerId);
    expect(order.items[0]!.sellerId).not.toBe(attackerSellerId);
  });

  it("rejects products that are not actively sellable", async () => {
    await expect(
      secureCreateOrder({
        userId: buyerId,
        type: "B2C",
        currency: "AED",
        items: [{ productId: inactiveProductId, quantity: 1 }],
        shippingAddress: { label: "Office", line1: "1 Test Street", city: "Dubai", country: "AE" },
      }),
    ).rejects.toThrow(/unavailable/i);
  });

  it("rejects a variant that belongs to a different product", async () => {
    await expect(
      secureCreateOrder({
        userId: buyerId,
        type: "B2C",
        currency: "AED",
        items: [{ productId, variantId: foreignVariantId, quantity: 1 }],
        shippingAddress: { label: "Office", line1: "1 Test Street", city: "Dubai", country: "AE" },
      }),
    ).rejects.toThrow(/variant is unavailable/i);
  });

  it("refuses B2B checkout when the authenticated buyer has no active company membership", async () => {
    await expect(
      secureCreateOrder({
        userId: buyerId,
        type: "B2B",
        currency: "AED",
        items: [{ productId, quantity: 1 }],
        shippingAddress: { label: "Office", line1: "1 Test Street", city: "Dubai", country: "AE" },
      }),
    ).rejects.toThrow(/company membership/i);
  });
});
