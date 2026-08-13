import { db } from "../index";
import type { Currency } from "@prisma/client";

export type PromotionEligibility = {
  productIds?: string[];
  categoryIds?: string[];
  brandIds?: string[];
  sellerIds?: string[];
  companyIds?: string[];
  countries?: string[];
  minQuantity?: number;
};

export type PromotionLine = {
  key: string;
  productId: string;
  categoryId: string;
  brandId?: string | null;
  sellerId: string;
  quantity: number;
  baseUnitPrice: number;
};

export type AppliedPromotion = {
  promotionId: string;
  name: string;
  source: "AUTOMATIC" | "COUPON";
  couponId?: string;
  couponCode?: string;
  discount: number;
};

export type PromotionEvaluation = {
  discountAmount: number;
  lineDiscounts: Record<string, number>;
  applied: AppliedPromotion[];
  explanation: Array<Record<string, unknown>>;
};

const money = (value: number) => Math.max(0, Number(value.toFixed(2)));
const nowActive = (startsAt: Date | null, endsAt: Date | null, now: Date) =>
  (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);

function asEligibility(value: unknown): PromotionEligibility {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PromotionEligibility;
}

function lineEligible(
  line: PromotionLine,
  eligibility: PromotionEligibility,
  companyId?: string,
  country?: string,
): boolean {
  if (eligibility.productIds?.length && !eligibility.productIds.includes(line.productId)) return false;
  if (eligibility.categoryIds?.length && !eligibility.categoryIds.includes(line.categoryId)) return false;
  if (eligibility.brandIds?.length && (!line.brandId || !eligibility.brandIds.includes(line.brandId))) return false;
  if (eligibility.sellerIds?.length && !eligibility.sellerIds.includes(line.sellerId)) return false;
  if (eligibility.companyIds?.length && (!companyId || !eligibility.companyIds.includes(companyId))) return false;
  if (eligibility.countries?.length && (!country || !eligibility.countries.includes(country))) return false;
  if (eligibility.minQuantity && line.quantity < eligibility.minQuantity) return false;
  return true;
}

export function calculatePromotionDiscount(
  promotion: {
    id: string;
    name: string;
    type: string;
    value: unknown;
    minOrderAmount: unknown | null;
    maxDiscountAmount: unknown | null;
    eligibility: unknown;
  },
  lines: PromotionLine[],
  companyId?: string,
  country?: string,
) {
  const orderSubtotal = lines.reduce((sum, line) => sum + line.baseUnitPrice * line.quantity, 0);
  const minOrder = promotion.minOrderAmount == null ? 0 : Number(promotion.minOrderAmount);
  if (orderSubtotal < minOrder) return { discount: 0, eligibleLineKeys: [] as string[] };

  const eligibility = asEligibility(promotion.eligibility);
  const eligibleLines = lines.filter((line) => lineEligible(line, eligibility, companyId, country));
  const eligibleSubtotal = eligibleLines.reduce((sum, line) => sum + line.baseUnitPrice * line.quantity, 0);
  if (eligibleSubtotal <= 0) return { discount: 0, eligibleLineKeys: [] as string[] };

  const value = Number(promotion.value);
  let discount = 0;
  if (promotion.type === "PERCENTAGE") {
    if (!(value > 0 && value <= 100)) return { discount: 0, eligibleLineKeys: [] as string[] };
    discount = eligibleSubtotal * (value / 100);
  } else if (promotion.type === "FIXED_AMOUNT") {
    if (!(value > 0)) return { discount: 0, eligibleLineKeys: [] as string[] };
    discount = Math.min(value, eligibleSubtotal);
  } else {
    return { discount: 0, eligibleLineKeys: [] as string[] };
  }

  const maxDiscount = promotion.maxDiscountAmount == null ? null : Number(promotion.maxDiscountAmount);
  if (maxDiscount != null && maxDiscount >= 0) discount = Math.min(discount, maxDiscount);
  return { discount: money(discount), eligibleLineKeys: eligibleLines.map((line) => line.key) };
}

function allocateDiscount(lines: PromotionLine[], eligibleKeys: string[], totalDiscount: number) {
  const result: Record<string, number> = {};
  if (totalDiscount <= 0 || eligibleKeys.length === 0) return result;

  const eligible = lines.filter((line) => eligibleKeys.includes(line.key));
  const basis = eligible.reduce((sum, line) => sum + line.baseUnitPrice * line.quantity, 0);
  if (basis <= 0) return result;

  let allocated = 0;
  eligible.forEach((line, index) => {
    const lineBasis = line.baseUnitPrice * line.quantity;
    const share = index === eligible.length - 1
      ? money(totalDiscount - allocated)
      : money(totalDiscount * (lineBasis / basis));
    result[line.key] = share;
    allocated = money(allocated + share);
  });
  return result;
}

function mergeLineDiscounts(target: Record<string, number>, addition: Record<string, number>) {
  for (const [key, value] of Object.entries(addition)) {
    target[key] = money((target[key] ?? 0) + value);
  }
}

/**
 * Server-side commercial promotion evaluation. The browser may supply only a
 * coupon code; it never supplies a discount amount. ERP/contract price should
 * already be represented by baseUnitPrice before this function runs.
 */
export async function evaluateCommercePromotions(input: {
  tenantKey?: string;
  userId: string;
  companyId?: string;
  currency: Currency;
  country?: string;
  couponCode?: string;
  lines: PromotionLine[];
}): Promise<PromotionEvaluation> {
  const tenantKey = input.tenantKey ?? "default";
  const now = new Date();
  const orderSubtotal = input.lines.reduce((sum, line) => sum + line.baseUnitPrice * line.quantity, 0);
  const lineDiscounts: Record<string, number> = {};
  const applied: AppliedPromotion[] = [];
  const explanation: Array<Record<string, unknown>> = [];

  const promotions = await db.commercePromotion.findMany({
    where: {
      tenantKey,
      status: "ACTIVE",
      currency: input.currency,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  const eligibleAutomatic = [] as Array<{
    promotion: (typeof promotions)[number];
    discount: number;
    eligibleLineKeys: string[];
  }>;

  for (const promotion of promotions) {
    if (promotion.scope === "SELLER" && promotion.sellerId && !input.lines.some((line) => line.sellerId === promotion.sellerId)) continue;
    if (promotion.scope === "COMPANY" && promotion.companyId !== input.companyId) continue;
    const usage = promotion.usageLimit
      ? await db.promotionRedemption.count({ where: { promotionId: promotion.id } })
      : 0;
    if (promotion.usageLimit && usage >= promotion.usageLimit) continue;
    if (promotion.perCustomerLimit) {
      const customerUsage = await db.promotionRedemption.count({ where: { promotionId: promotion.id, userId: input.userId } });
      if (customerUsage >= promotion.perCustomerLimit) continue;
    }
    const calculated = calculatePromotionDiscount(promotion, input.lines, input.companyId, input.country);
    if (calculated.discount > 0) eligibleAutomatic.push({ promotion, ...calculated });
  }

  // Non-stackable automatic promotions compete on best customer value. Stackable
  // promotions may join the winner in priority order, but never discount below 0.
  const nonStackable = eligibleAutomatic.filter((candidate) => !candidate.promotion.stackable);
  const bestNonStackable = nonStackable.sort((a, b) => b.discount - a.discount || a.promotion.priority - b.promotion.priority)[0];
  const selectedAutomatic = [
    ...(bestNonStackable ? [bestNonStackable] : []),
    ...eligibleAutomatic.filter((candidate) => candidate.promotion.stackable),
  ];

  for (const candidate of selectedAutomatic) {
    const remaining = money(orderSubtotal - Object.values(lineDiscounts).reduce((a, b) => a + b, 0));
    const discount = Math.min(candidate.discount, remaining);
    if (discount <= 0) continue;
    mergeLineDiscounts(lineDiscounts, allocateDiscount(input.lines, candidate.eligibleLineKeys, discount));
    applied.push({
      promotionId: candidate.promotion.id,
      name: candidate.promotion.name,
      source: "AUTOMATIC",
      discount,
    });
    explanation.push({
      step: "PROMOTION",
      promotionId: candidate.promotion.id,
      name: candidate.promotion.name,
      type: candidate.promotion.type,
      value: Number(candidate.promotion.value),
      discount,
    });
  }

  if (input.couponCode?.trim()) {
    const normalized = input.couponCode.trim().toUpperCase();
    const coupon = await db.promotionCoupon.findUnique({ where: { code: normalized } });
    if (!coupon || coupon.status !== "ACTIVE" || !nowActive(coupon.startsAt, coupon.endsAt, now)) {
      throw new Error("Coupon code is invalid or inactive");
    }
    const couponPromotion = promotions.find((promotion) => promotion.id === coupon.promotionId);
    if (!couponPromotion) throw new Error("Coupon promotion is not active for this order");

    if (coupon.usageLimit) {
      const uses = await db.promotionRedemption.count({ where: { couponId: coupon.id } });
      if (uses >= coupon.usageLimit) throw new Error("Coupon usage limit has been reached");
    }
    if (coupon.perCustomerLimit) {
      const uses = await db.promotionRedemption.count({ where: { couponId: coupon.id, userId: input.userId } });
      if (uses >= coupon.perCustomerLimit) throw new Error("Coupon usage limit has been reached for this account");
    }

    const calculated = calculatePromotionDiscount(couponPromotion, input.lines, input.companyId, input.country);
    if (calculated.discount <= 0) throw new Error("Coupon is not eligible for this order");

    // If the coupon's promotion is non-stackable, compare it with all already
    // selected non-stackable benefit and keep the better one. Stackable automatic
    // discounts remain only when the coupon itself allows stacking.
    if (!couponPromotion.stackable) {
      const currentTotal = Object.values(lineDiscounts).reduce((a, b) => a + b, 0);
      if (calculated.discount > currentTotal) {
        for (const key of Object.keys(lineDiscounts)) delete lineDiscounts[key];
        applied.length = 0;
        explanation.length = 0;
      } else if (currentTotal > 0) {
        throw new Error("Coupon cannot be combined with the better active promotion");
      }
    }

    const remaining = money(orderSubtotal - Object.values(lineDiscounts).reduce((a, b) => a + b, 0));
    const discount = Math.min(calculated.discount, remaining);
    mergeLineDiscounts(lineDiscounts, allocateDiscount(input.lines, calculated.eligibleLineKeys, discount));
    applied.push({
      promotionId: couponPromotion.id,
      name: couponPromotion.name,
      source: "COUPON",
      couponId: coupon.id,
      couponCode: coupon.code,
      discount,
    });
    explanation.push({
      step: "COUPON",
      promotionId: couponPromotion.id,
      couponId: coupon.id,
      code: coupon.code,
      discount,
    });
  }

  return {
    discountAmount: money(Object.values(lineDiscounts).reduce((a, b) => a + b, 0)),
    lineDiscounts,
    applied,
    explanation,
  };
}
