import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { enforcePromotionRedemptionCapacity } from "../services/promotions";

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    commercePromotion: {
      findUnique: vi.fn().mockResolvedValue({
        id: "promo_1",
        status: "ACTIVE",
        currency: "AED",
        type: "PERCENTAGE",
        value: 20,
        scope: "PLATFORM",
        eligibility: {},
        startsAt: null,
        endsAt: null,
        minOrderAmount: null,
        maxDiscountAmount: null,
        usageLimit: 10,
        perCustomerLimit: 2,
        campaignBudget: 100,
      }),
    },
    promotionCoupon: {
      findUnique: vi.fn().mockResolvedValue({
        id: "coupon_1", promotionId: "promo_1", status: "ACTIVE", usageLimit: 5, perCustomerLimit: 1,
        startsAt: null, endsAt: null,
      }),
    },
    promotionRedemption: {
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { discountAmount: 70 } }),
    },
    ...overrides,
  };
}

describe("promotion redemption concurrency capacity", () => {
  const lines = [{
    key: "line-1", productId: "product-1", categoryId: "category-1", sellerId: "seller-1",
    quantity: 1, baseUnitPrice: 200,
  }];

  it("takes transaction advisory locks before accepting available campaign capacity", async () => {
    const tx = transaction();
    await expect(enforcePromotionRedemptionCapacity(tx as unknown as Prisma.TransactionClient, {
      userId: "user_1",
      currency: "AED",
      lines,
      applied: [{ promotionId: "promo_1", couponId: "coupon_1", source: "COUPON", discount: 30, eligibleLineKeys: ["line-1"] }],
    })).resolves.toBeUndefined();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.commercePromotion.findUnique.mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.$executeRaw.mock.invocationCallOrder[1] ?? 0,
    );
  });

  it("rejects a redemption that would overspend the locked campaign budget", async () => {
    const tx = transaction();
    await expect(enforcePromotionRedemptionCapacity(tx as unknown as Prisma.TransactionClient, {
      userId: "user_1",
      currency: "AED",
      lines,
      applied: [{ promotionId: "promo_1", source: "AUTOMATIC", discount: 30.01, eligibleLineKeys: ["line-1"] }],
    })).rejects.toThrow(/campaign budget/);
  });

  it("enforces coupon per-customer usage while holding the coupon lock", async () => {
    const tx = transaction();
    tx.promotionRedemption.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    await expect(enforcePromotionRedemptionCapacity(tx as unknown as Prisma.TransactionClient, {
      userId: "user_1",
      currency: "AED",
      lines,
      applied: [{ promotionId: "promo_1", couponId: "coupon_1", source: "COUPON", discount: 20, eligibleLineKeys: ["line-1"] }],
    })).rejects.toThrow(/this account/);
  });
});
