"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import {
  ShippingBandInvalidError,
  ShippingZoneOverlapError,
  createShippingZone,
  upsertShippingRate,
} from "@avenick/database";
import { log } from "@avenick/observability";
import type { ActionResult } from "@/app/approvals/actions";

/**
 * Tariff administration. Presentation aside, the point of these actions is that
 * a configuration mistake is refused HERE, where the operator can still fix it,
 * rather than surfacing at checkout as a wrong price or a refused order for a
 * buyer who did nothing wrong.
 */
type Translator = (key: string, values?: Record<string, string | number>) => string;

const zoneSchema = (t: Translator) =>
  z.object({
    code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/, t("actions.shipping.codeShape")),
    nameEn: z.string().trim().min(2).max(120),
    nameAr: z.string().trim().min(2).max(120),
    // ISO-3166 alpha-2, uppercased. Anything else would silently never match a
    // destination, which reads as "we don't ship there" for a typo.
    countries: z
      .string()
      .trim()
      .min(2)
      .transform((value) => value.split(/[,\s]+/).filter(Boolean).map((code) => code.toUpperCase()))
      .pipe(z.array(z.string().regex(/^[A-Z]{2}$/, t("actions.shipping.countryShape"))).min(1)),
    fallbackPrice: z.coerce.number().min(0).max(999_999),
    freeOverSubtotal: z.coerce.number().min(0).max(9_999_999).nullable(),
    etaMinDays: z.coerce.number().int().min(0).max(365).nullable(),
    etaMaxDays: z.coerce.number().int().min(0).max(365).nullable(),
    isActive: z.coerce.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(9999),
  });

function read(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function optionalNumber(form: FormData, key: string): number | null {
  const raw = read(form, key).trim();
  return raw === "" ? null : Number(raw);
}

export async function createZoneAction(form: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce");
  const parsed = zoneSchema(t).safeParse({
    code: read(form, "code"),
    nameEn: read(form, "nameEn"),
    nameAr: read(form, "nameAr"),
    countries: read(form, "countries"),
    fallbackPrice: read(form, "fallbackPrice") || 0,
    freeOverSubtotal: optionalNumber(form, "freeOverSubtotal"),
    etaMinDays: optionalNumber(form, "etaMinDays"),
    etaMaxDays: optionalNumber(form, "etaMaxDays"),
    isActive: form.get("isActive") === "on",
    sortOrder: read(form, "sortOrder") || 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("actions.shipping.invalid") };
  }
  // An ETA that ends before it begins is not a range; it would render as
  // "5–2 days" to a buyer.
  const { etaMinDays, etaMaxDays } = parsed.data;
  if (etaMinDays != null && etaMaxDays != null && etaMaxDays < etaMinDays) {
    return { ok: false, error: t("actions.shipping.etaOrder") };
  }

  try {
    await createShippingZone(parsed.data);
    revalidatePath("/shipping-zones");
    return { ok: true };
  } catch (error) {
    // The overlap error already names every offending country and the zone that
    // holds it; passing it through is more useful than a generic failure.
    if (error instanceof ShippingZoneOverlapError) {
      return { ok: false, error: error.message };
    }
    log.error("shipping zone create failed", error, { scope: "shipping.zone.create" });
    return { ok: false, error: t("actions.shipping.createFailed") };
  }
}

const rateSchema = z.object({
  zoneId: z.string().trim().min(1),
  currency: z.enum(["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "USD"]),
  minWeightKg: z.coerce.number().min(0).max(100_000),
  maxWeightKg: z.coerce.number().min(0).max(100_000).nullable(),
  price: z.coerce.number().min(0).max(999_999),
  isActive: z.coerce.boolean(),
});

export async function saveRateAction(form: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce");
  const parsed = rateSchema.safeParse({
    zoneId: read(form, "zoneId"),
    currency: read(form, "currency"),
    minWeightKg: read(form, "minWeightKg") || 0,
    maxWeightKg: optionalNumber(form, "maxWeightKg"),
    price: read(form, "price") || 0,
    isActive: form.get("isActive") !== "off",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("actions.shipping.invalid") };
  }
  try {
    await upsertShippingRate(read(form, "rateId") || null, parsed.data);
    revalidatePath("/shipping-zones");
    return { ok: true };
  } catch (error) {
    // A band that overlaps or inverts is a configuration mistake with a precise
    // description; the operator gets that description, not "failed".
    if (error instanceof ShippingBandInvalidError) {
      return { ok: false, error: error.message };
    }
    log.error("shipping rate save failed", error, { scope: "shipping.rate.save" });
    return { ok: false, error: t("actions.shipping.rateFailed") };
  }
}
