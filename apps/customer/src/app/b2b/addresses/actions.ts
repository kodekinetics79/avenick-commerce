"use server";

import { revalidatePath } from "next/cache";
import { db } from "@avenick/database";
import { getB2BContext, type B2BActionState } from "@/lib/b2b";
import { actionT } from "@/components/b2b/action-i18n";

const COUNTRIES = ["AE", "SA", "QA", "KW", "OM", "BH"] as const;

export async function createAddress(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  const t = actionT();
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return { error: t("act.sites.adminOnly") };

  const label = String(formData.get("label") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const line2 = String(formData.get("line2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "AE") as (typeof COUNTRIES)[number];
  const postalCode = String(formData.get("postalCode") ?? "").trim() || null;

  if (!label || !line1 || !city) return { error: t("act.sites.required") };

  const existing = await db.address.count({ where: { companyId: ctx.companyId } });
  await db.address.create({
    data: {
      companyId: ctx.companyId,
      label,
      line1,
      line2,
      city,
      country: COUNTRIES.includes(country) ? country : "AE",
      postalCode,
      isDefault: existing === 0, // first site becomes the default
    },
  });
  revalidatePath("/b2b/addresses");
  return { ok: true, message: t("act.sites.added", { label }) };
}

export async function setDefaultAddress(id: string) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return;
  const addr = await db.address.findUnique({ where: { id } });
  if (!addr || addr.companyId !== ctx.companyId) return;

  await db.$transaction([
    db.address.updateMany({ where: { companyId: ctx.companyId }, data: { isDefault: false } }),
    db.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/b2b/addresses");
  
}

export async function deleteAddress(id: string) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return;
  const addr = await db.address.findUnique({ where: { id } });
  if (!addr || addr.companyId !== ctx.companyId) return;
  await db.address.delete({ where: { id } });
  revalidatePath("/b2b/addresses");
  
}
