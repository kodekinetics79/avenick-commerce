"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { AuditAction, db, type Currency, type Prisma } from "@avenick/database";

const PROMOTION_TYPES = new Set(["PERCENTAGE", "FIXED_AMOUNT"]);
const PROMOTION_STATUSES = new Set(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]);
const CURRENCIES = new Set(["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"]);

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optionalNumber = (form: FormData, key: string) => {
  const value = text(form, key);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${key} must be a non-negative number`);
  return parsed;
};
const optionalInt = (form: FormData, key: string) => {
  const n = optionalNumber(form, key);
  if (n == null) return null;
  if (!Number.isInteger(n)) throw new Error(`${key} must be a whole number`);
  return n;
};
const optionalDate = (form: FormData, key: string) => {
  const value = text(form, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${key} is not a valid date`);
  return date;
};
const jsonObject = (value: Prisma.JsonValue | null): Prisma.InputJsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Prisma.InputJsonObject;
};

export async function createPromotion(formData: FormData) {
  const { userId } = await requireAdminSession();
  const name = text(formData, "name");
  const type = text(formData, "type").toUpperCase();
  const currency = text(formData, "currency").toUpperCase();
  const value = optionalNumber(formData, "value");
  if (name.length < 2 || name.length > 120) throw new Error("Promotion name must be 2-120 characters");
  if (!PROMOTION_TYPES.has(type)) throw new Error("Unsupported promotion type");
  if (!CURRENCIES.has(currency)) throw new Error("Unsupported currency");
  if (value == null || value <= 0 || (type === "PERCENTAGE" && value > 100)) throw new Error("Invalid promotion value");

  const startsAt = optionalDate(formData, "startsAt");
  const endsAt = optionalDate(formData, "endsAt");
  if (startsAt && endsAt && endsAt <= startsAt) throw new Error("Promotion end must be after start");

  const promotion = await db.commercePromotion.create({
    data: {
      tenantKey: "default",
      name,
      description: text(formData, "description") || null,
      type,
      status: "DRAFT",
      scope: "PLATFORM",
      currency: currency as Currency,
      value,
      minOrderAmount: optionalNumber(formData, "minOrderAmount"),
      maxDiscountAmount: optionalNumber(formData, "maxDiscountAmount"),
      usageLimit: optionalInt(formData, "usageLimit"),
      perCustomerLimit: optionalInt(formData, "perCustomerLimit"),
      stackable: formData.get("stackable") === "on",
      priority: optionalInt(formData, "priority") ?? 100,
      startsAt,
      endsAt,
      createdById: userId,
    },
  });

  await db.auditLog.create({
    data: {
      actorId: userId,
      entityType: "CommercePromotion",
      entityId: promotion.id,
      action: AuditAction.CREATE,
      after: {
        name: promotion.name,
        type: promotion.type,
        currency: promotion.currency,
        value: Number(promotion.value),
        status: promotion.status,
      },
    },
  });
  revalidatePath("/campaigns");
}

export async function setPromotionStatus(id: string, status: string) {
  const { userId } = await requireAdminSession();
  const next = status.toUpperCase();
  if (!PROMOTION_STATUSES.has(next)) throw new Error("Unsupported promotion status");
  const current = await db.commercePromotion.findUnique({ where: { id } });
  if (!current || current.status === next) return;
  if (next === "ACTIVE" && current.endsAt && current.endsAt < new Date()) throw new Error("Expired promotion cannot be activated");

  await db.$transaction([
    db.commercePromotion.update({
      where: { id },
      data: {
        status: next,
        ...(next === "ACTIVE" ? { approvedById: userId } : {}),
      },
    }),
    db.auditLog.create({
      data: {
        actorId: userId,
        entityType: "CommercePromotion",
        entityId: id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: current.status },
        after: { status: next },
      },
    }),
  ]);
  revalidatePath("/campaigns");
}

export async function createCoupon(formData: FormData) {
  const { userId } = await requireAdminSession();
  const promotionId = text(formData, "promotionId");
  const code = text(formData, "code").toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error("Coupon code must be 3-40 letters/numbers/_/-");
  const promotion = await db.commercePromotion.findUnique({ where: { id: promotionId } });
  if (!promotion) throw new Error("Promotion not found");

  const startsAt = optionalDate(formData, "startsAt");
  const endsAt = optionalDate(formData, "endsAt");
  if (startsAt && endsAt && endsAt <= startsAt) throw new Error("Coupon end must be after start");
  const eligibility: Prisma.InputJsonObject = {
    ...jsonObject(promotion.eligibility),
    requiresCoupon: true,
  };

  const coupon = await db.$transaction(async (tx) => {
    // Once a coupon exists against a promotion, that promotion becomes coupon-
    // gated. Otherwise checkout could apply the same rule automatically and then
    // apply it again when the buyer supplies the code.
    await tx.commercePromotion.update({
      where: { id: promotionId },
      data: { eligibility },
    });
    const created = await tx.promotionCoupon.create({
      data: {
        promotionId,
        code,
        status: "ACTIVE",
        usageLimit: optionalInt(formData, "usageLimit"),
        perCustomerLimit: optionalInt(formData, "perCustomerLimit"),
        startsAt,
        endsAt,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        entityType: "PromotionCoupon",
        entityId: created.id,
        action: AuditAction.CREATE,
        after: {
          code: created.code,
          promotionId: created.promotionId,
          status: created.status,
          promotionMode: "COUPON_ONLY",
        },
      },
    });
    return created;
  });

  if (!coupon) throw new Error("Coupon creation failed");
  revalidatePath("/campaigns");
}

export async function createReferralProgram(formData: FormData) {
  const { userId } = await requireAdminSession();
  const name = text(formData, "name");
  const currency = text(formData, "currency").toUpperCase();
  const referrerRewardValue = optionalNumber(formData, "referrerRewardValue");
  const refereeRewardValue = optionalNumber(formData, "refereeRewardValue");
  if (name.length < 2 || name.length > 120) throw new Error("Referral program name must be 2-120 characters");
  if (!CURRENCIES.has(currency)) throw new Error("Unsupported currency");
  if (referrerRewardValue == null || refereeRewardValue == null) throw new Error("Referral rewards are required");

  const startsAt = optionalDate(formData, "startsAt");
  const endsAt = optionalDate(formData, "endsAt");
  if (startsAt && endsAt && endsAt <= startsAt) throw new Error("Referral program end must be after start");

  const program = await db.referralProgram.create({
    data: {
      tenantKey: "default",
      name,
      status: "DRAFT",
      referrerRewardType: "FIXED_AMOUNT",
      referrerRewardValue,
      refereeRewardType: "FIXED_AMOUNT",
      refereeRewardValue,
      currency: currency as Currency,
      maxUsesPerCode: optionalInt(formData, "maxUsesPerCode"),
      startsAt,
      endsAt,
      eligibility: { createdById: userId },
    },
  });
  await db.auditLog.create({
    data: {
      actorId: userId,
      entityType: "ReferralProgram",
      entityId: program.id,
      action: AuditAction.CREATE,
      after: { name: program.name, status: program.status, currency: program.currency },
    },
  });
  revalidatePath("/campaigns");
}
