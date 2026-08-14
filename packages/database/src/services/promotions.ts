import { db } from "../index";
import { Prisma, type Currency } from "@prisma/client";

export type PromotionEligibility = {
  productIds?: string[];
  categoryIds?: string[];
  brandIds?: string[];
  sellerIds?: string[];
  companyIds?: string[];
  countries?: string[];
  minQuantity?: number;
  /** Coupon-backed rules must never be applied as automatic promotions. */
  requiresCoupon?: boolean;
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
  eligibleLineKeys: string[];
};

export type PromotionEvaluation = {
  discountAmount: number;
  lineDiscounts: Record<string, number>;
  applied: AppliedPromotion[];
  explanation: Array<Record<string, unknown>>;
};

export type PromotionRedemptionCandidate = Pick<AppliedPromotion, "promotionId" | "couponId" | "discount" | "source" | "eligibleLineKeys">;

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

/** Campaign mutations and redemption decisions use one globally ordered fence. */
export async function lockPromotionCommercialRows(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  promotionIds: string[],
  couponIds: string[] = [],
) {
  const keys = [
    ...new Set(promotionIds.map((id) => `promotion:${id}`)),
    ...new Set(couponIds.map((id) => `coupon:${id}`)),
  ].sort();
  for (const key of keys) {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
  }
}

/**
 * Must be called inside the same transaction that creates PromotionRedemption
 * rows. Sorted transaction-scoped advisory locks serialize every checkout that
 * consumes the same campaign/coupon, making count and budget checks authoritative
 * under concurrency without adding a separate reservation table.
 */
export async function enforcePromotionRedemptionCapacity(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    currency: Currency;
    companyId?: string;
    country?: string;
    lines: PromotionLine[];
    applied: PromotionRedemptionCandidate[];
  },
) {
  const promotionIds = [...new Set(input.applied.map((item) => item.promotionId))].sort();
  const couponIds = [...new Set(input.applied.flatMap((item) => item.couponId ? [item.couponId] : []))].sort();
  await lockPromotionCommercialRows(tx, promotionIds, couponIds);

  for (const promotionId of promotionIds) {
    const promotion = await tx.commercePromotion.findUnique({ where: { id: promotionId } });
    const now = new Date();
    if (!promotion || promotion.status !== "ACTIVE" || (promotion.currency && promotion.currency !== input.currency)
      || !nowActive(promotion.startsAt, promotion.endsAt, now)) {
      throw new Error("Promotion changed while the order was being submitted");
    }
    const candidates = input.applied.filter((item) => item.promotionId === promotionId);
    const eligibility = asEligibility(promotion.eligibility);
    if (candidates.some((item) => item.source === "AUTOMATIC") && eligibility.requiresCoupon) {
      throw new Error("Promotion changed to coupon-only while the order was being submitted");
    }
    if (promotion.scope === "SELLER" && promotion.sellerId && !input.lines.some((line) => line.sellerId === promotion.sellerId)) {
      throw new Error("Promotion eligibility changed while the order was being submitted");
    }
    if (promotion.scope === "COMPANY" && promotion.companyId !== input.companyId) {
      throw new Error("Promotion eligibility changed while the order was being submitted");
    }
    const recalculated = calculatePromotionDiscount(promotion, input.lines, input.companyId, input.country);
    const eligibleLineKeys = [...recalculated.eligibleLineKeys].sort();
    if (candidates.some((item) => JSON.stringify([...item.eligibleLineKeys].sort()) !== JSON.stringify(eligibleLineKeys))) {
      throw new Error("Promotion eligibility changed while the order was being submitted");
    }
    const candidateDiscount = money(input.applied
      .filter((item) => item.promotionId === promotionId)
      .reduce((sum, item) => sum + item.discount, 0));
    if (recalculated.discount <= 0 || candidateDiscount > recalculated.discount) {
      throw new Error("Promotion eligibility changed while the order was being submitted");
    }
    const [usage, customerUsage, spent] = await Promise.all([
      tx.promotionRedemption.count({ where: { promotionId } }),
      tx.promotionRedemption.count({ where: { promotionId, userId: input.userId } }),
      promotion.campaignBudget
        ? tx.promotionRedemption.aggregate({ where: { promotionId }, _sum: { discountAmount: true } })
        : Promise.resolve(null),
    ]);
    if (promotion.usageLimit && usage >= promotion.usageLimit) throw new Error("Promotion usage limit has been reached");
    if (promotion.perCustomerLimit && customerUsage >= promotion.perCustomerLimit) {
      throw new Error("Promotion usage limit has been reached for this account");
    }
    if (promotion.campaignBudget) {
      const consumed = Number(spent?._sum.discountAmount ?? 0);
      if (money(consumed + candidateDiscount) > Number(promotion.campaignBudget)) {
        throw new Error("Promotion campaign budget has been reached");
      }
    }
  }

  for (const couponId of couponIds) {
    const coupon = await tx.promotionCoupon.findUnique({ where: { id: couponId } });
    const candidate = input.applied.find((item) => item.couponId === couponId);
    if (!coupon || coupon.status !== "ACTIVE" || !nowActive(coupon.startsAt, coupon.endsAt, new Date())
      || !candidate || candidate.source !== "COUPON" || coupon.promotionId !== candidate.promotionId) {
      throw new Error("Coupon changed while the order was being submitted");
    }
    const [usage, customerUsage] = await Promise.all([
      tx.promotionRedemption.count({ where: { couponId } }),
      tx.promotionRedemption.count({ where: { couponId, userId: input.userId } }),
    ]);
    if (coupon.usageLimit && usage >= coupon.usageLimit) throw new Error("Coupon usage limit has been reached");
    if (coupon.perCustomerLimit && customerUsage >= coupon.perCustomerLimit) {
      throw new Error("Coupon usage limit has been reached for this account");
    }
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
    const eligibility = asEligibility(promotion.eligibility);
    // A rule becomes coupon-only as soon as a coupon is issued against it. This
    // prevents the same rule from applying once automatically and again by code.
    if (eligibility.requiresCoupon) continue;
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
    if (promotion.campaignBudget && calculated.discount > 0) {
      const spent = await db.promotionRedemption.aggregate({
        where: { promotionId: promotion.id },
        _sum: { discountAmount: true },
      });
      if (money(Number(spent._sum.discountAmount ?? 0) + calculated.discount) > Number(promotion.campaignBudget)) continue;
    }
    if (calculated.discount > 0) eligibleAutomatic.push({ promotion, ...calculated });
  }

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
      eligibleLineKeys: candidate.eligibleLineKeys,
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
    if (couponPromotion.campaignBudget) {
      const spent = await db.promotionRedemption.aggregate({
        where: { promotionId: couponPromotion.id },
        _sum: { discountAmount: true },
      });
      if (money(Number(spent._sum.discountAmount ?? 0) + calculated.discount) > Number(couponPromotion.campaignBudget)) {
        throw new Error("Coupon promotion campaign budget has been reached");
      }
    }

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
      eligibleLineKeys: calculated.eligibleLineKeys,
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
