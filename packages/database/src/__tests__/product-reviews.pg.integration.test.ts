import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  createProductReview,
  getReviewEligibility,
  normalizeReviewText,
  ProductReviewError,
} from "../services/product-reviews";

/**
 * Verified-purchase reviews against a real Postgres.
 *
 * The rule under test is the one the storefront badge relies on: a review can
 * be written only by a buyer with a DELIVERED order containing the product,
 * and `isVerified` is stamped from exactly that check. Skipped without
 * DATABASE_URL like the other pg integration suites.
 */
const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;

const ids = { users: [] as string[], sellers: [] as string[], products: [] as string[], orders: [] as string[] };
let categoryId: string | null = null;

let buyerId = "";          // has a DELIVERED order for `receivedProductId`
let windowShopperId = "";  // signed in; one SHIPPED order and one DELIVERED order whose line was cancelled
let suspendedId = "";      // bought and received, then suspended
let receivedProductId = "";
let otherProductId = "";   // same seller, never ordered by anyone

async function expectCode(promise: Promise<unknown>, code: ProductReviewError["code"]) {
  const error = await promise.then(() => null, (thrown: unknown) => thrown);
  expect(error).toBeInstanceOf(ProductReviewError);
  expect((error as ProductReviewError).code).toBe(code);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const [buyer, shopper, suspended, owner] = await Promise.all([
    db.user.create({ data: { email: `rev-buyer-${stamp}@test.invalid`, firstName: "Review", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `rev-shopper-${stamp}@test.invalid`, firstName: "Window", lastName: "Shopper", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `rev-suspended-${stamp}@test.invalid`, firstName: "Later", lastName: "Suspended", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `rev-owner-${stamp}@test.invalid`, firstName: "Seller", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  ids.users.push(buyer.id, shopper.id, suspended.id, owner.id);
  buyerId = buyer.id;
  windowShopperId = shopper.id;
  suspendedId = suspended.id;

  const seller = await db.sellerProfile.create({ data: { userId: owner.id, businessNameEn: `Reviews ${stamp}`, crNumber: `REV-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } });
  ids.sellers.push(seller.id);

  const category = await db.category.create({ data: { nameEn: `Reviews ${stamp}`, nameAr: `Reviews ${stamp}`, slug: `reviews-${stamp}` } });
  categoryId = category.id;

  const [received, other] = await Promise.all([
    db.product.create({ data: { sellerId: seller.id, categoryId, sku: `REV-P1-${stamp}`, slug: `rev-p1-${stamp}`, nameEn: "Reviewed line", nameAr: "Reviewed line", status: "ACTIVE" } }),
    db.product.create({ data: { sellerId: seller.id, categoryId, sku: `REV-P2-${stamp}`, slug: `rev-p2-${stamp}`, nameEn: "Unordered line", nameAr: "Unordered line", status: "ACTIVE" } }),
  ]);
  ids.products.push(received.id, other.id);
  receivedProductId = received.id;
  otherProductId = other.id;

  const orderFor = (userId: string, status: "DELIVERED" | "SHIPPED", suffix: string, lineStatus: "DELIVERED" | "SHIPPED" | "CANCELLED" = status) => db.order.create({
    data: {
      orderNumber: `REV-${suffix}-${stamp}`,
      userId,
      type: "B2C",
      status,
      paymentStatus: "PAID",
      currency: "AED",
      subtotal: 100,
      vatAmount: 5,
      total: 105,
      shippingAddress: { line1: "Test", city: "Dubai", country: "AE" },
      items: { create: [
        { productId: received.id, sellerId: seller.id, sku: received.sku, nameEn: received.nameEn, nameAr: received.nameAr, quantity: 1, unitPrice: 100, vatAmount: 5, total: 105, status: lineStatus },
      ] },
    },
  });

  const [deliveredForBuyer, deliveredForSuspended, shippedOnly, cancelledLine] = await Promise.all([
    orderFor(buyer.id, "DELIVERED", "B"),
    orderFor(suspended.id, "DELIVERED", "S"),
    // A shipped-but-not-delivered order must not count as a receipt.
    orderFor(shopper.id, "SHIPPED", "W"),
    // Nor does a delivered order whose line for this product was cancelled.
    orderFor(shopper.id, "DELIVERED", "WC", "CANCELLED"),
  ]);
  ids.orders.push(deliveredForBuyer.id, deliveredForSuspended.id, shippedOnly.id, cancelledLine.id);

  await db.user.update({ where: { id: suspended.id }, data: { status: "SUSPENDED" } });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await db.auditLog.deleteMany({ where: { entityType: "ProductReview", actorId: { in: ids.users } } });
  await db.productReview.deleteMany({ where: { productId: { in: ids.products } } });
  await db.order.deleteMany({ where: { id: { in: ids.orders } } });
  await db.product.deleteMany({ where: { id: { in: ids.products } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerProfile.deleteMany({ where: { id: { in: ids.sellers } } });
  await db.user.deleteMany({ where: { id: { in: ids.users } } });
});

run("verified-purchase product reviews", () => {
  it("answers anonymous visitors honestly", async () => {
    await expect(getReviewEligibility({ userId: null, productId: receivedProductId }))
      .resolves.toEqual({ eligible: false, reason: "anonymous" });
  });

  it("refuses a buyer whose order has not been delivered, or whose delivered line was cancelled", async () => {
    await expect(getReviewEligibility({ userId: windowShopperId, productId: receivedProductId }))
      .resolves.toEqual({ eligible: false, reason: "not-purchased" });
    await expectCode(
      createProductReview({ productId: receivedProductId, userId: windowShopperId, rating: 5 }),
      "NOT_ELIGIBLE",
    );
    expect(await db.productReview.count({ where: { productId: receivedProductId, userId: windowShopperId } })).toBe(0);
  });

  it("refuses a delivered buyer for a product that was not on the order", async () => {
    await expect(getReviewEligibility({ userId: buyerId, productId: otherProductId }))
      .resolves.toEqual({ eligible: false, reason: "not-purchased" });
    await expectCode(
      createProductReview({ productId: otherProductId, userId: buyerId, rating: 4 }),
      "NOT_ELIGIBLE",
    );
  });

  it("rejects an out-of-range rating before touching the database", async () => {
    await expectCode(createProductReview({ productId: receivedProductId, userId: buyerId, rating: 0 }), "INVALID_INPUT");
    await expectCode(createProductReview({ productId: receivedProductId, userId: buyerId, rating: 6 }), "INVALID_INPUT");
    await expectCode(createProductReview({ productId: receivedProductId, userId: buyerId, rating: 4.5 }), "INVALID_INPUT");
    await expectCode(
      createProductReview({ productId: receivedProductId, userId: buyerId, rating: 4, body: "too short" }),
      "INVALID_INPUT",
    );
    expect(await db.productReview.count({ where: { productId: receivedProductId, userId: buyerId } })).toBe(0);
  });

  it("stores a verified review, once, for a buyer who received the product", async () => {
    await expect(getReviewEligibility({ userId: buyerId, productId: receivedProductId }))
      .resolves.toEqual({ eligible: true, reason: "ok" });

    const review = await createProductReview({
      productId: receivedProductId,
      userId: buyerId,
      rating: 4,
      title: "  Solid\u0000 kit ",
      body: "Arrived on time and\u001b worked as described.",
    });

    expect(review.isVerified).toBe(true);
    expect(review.rating).toBe(4);
    // Control characters are gone and the edges are trimmed; the words survive.
    expect(review.title).toBe("Solid kit");
    expect(review.body).toBe("Arrived on time and worked as described.");

    const audit = await db.auditLog.findMany({ where: { entityType: "ProductReview", entityId: review.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: buyerId, action: "CREATE" });
    expect(audit[0].after).toMatchObject({ productId: receivedProductId, rating: 4, isVerified: true });

    await expect(getReviewEligibility({ userId: buyerId, productId: receivedProductId }))
      .resolves.toEqual({ eligible: false, reason: "already-reviewed" });
    await expectCode(
      createProductReview({ productId: receivedProductId, userId: buyerId, rating: 2 }),
      "ALREADY_REVIEWED",
    );
    expect(await db.productReview.count({ where: { productId: receivedProductId, userId: buyerId } })).toBe(1);
  });

  it("refuses a suspended account even though it received the product", async () => {
    await expectCode(
      createProductReview({ productId: receivedProductId, userId: suspendedId, rating: 5 }),
      "ACCOUNT_INACTIVE",
    );
    expect(await db.productReview.count({ where: { productId: receivedProductId, userId: suspendedId } })).toBe(0);
  });

  it("refuses a review for a product that is not live", async () => {
    await db.product.update({ where: { id: otherProductId }, data: { status: "DRAFT" } });
    try {
      // The buyer never received this product anyway, but the product check
      // runs first so a hidden product never leaks an eligibility answer.
      await expectCode(
        createProductReview({ productId: otherProductId, userId: buyerId, rating: 3 }),
        "PRODUCT_NOT_FOUND",
      );
    } finally {
      await db.product.update({ where: { id: otherProductId }, data: { status: "ACTIVE" } });
    }
  });
});

describe("normalizeReviewText", () => {
  it("drops control characters, keeps tabs and newlines, trims, and nulls empties", () => {
    expect(normalizeReviewText("a\u0000b\u0007c")).toBe("abc");
    expect(normalizeReviewText("line one\nline\ttwo\r\n")).toBe("line one\nline\ttwo");
    expect(normalizeReviewText("  \u001b[31m  ")).toBe("[31m");
    expect(normalizeReviewText("   ")).toBeNull();
    expect(normalizeReviewText("")).toBeNull();
    expect(normalizeReviewText(null)).toBeNull();
    expect(normalizeReviewText(undefined)).toBeNull();
    expect(normalizeReviewText("مرحبا بالعالم")).toBe("مرحبا بالعالم");
  });
});
