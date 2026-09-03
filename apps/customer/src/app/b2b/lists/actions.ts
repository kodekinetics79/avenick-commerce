"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@avenick/database";
import { getB2BContext, type B2BActionState } from "@/lib/b2b";
import { actionT } from "@/components/b2b/action-i18n";
import { companyCurrencyForCountry } from "@/lib/company-currency";

export async function createList(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  const t = actionT();
  const ctx = await getB2BContext();
  if (!ctx) return { error: t("act.list.noCompany") };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("act.list.needName") };

  await db.requisitionList.create({ data: { companyId: ctx.companyId, ownerId: ctx.userId, name } });
  revalidatePath("/b2b/lists");
  return { ok: true, message: t("act.list.created", { name }) };
}

export async function deleteList(id: string) {
  const ctx = await getB2BContext();
  if (!ctx) return;
  const list = await db.requisitionList.findUnique({ where: { id } });
  if (!list || list.companyId !== ctx.companyId) return;
  await db.requisitionList.delete({ where: { id } });
  revalidatePath("/b2b/lists");
}

export async function addItem(listId: string, formData: FormData) {
  const ctx = await getB2BContext();
  if (!ctx) return;
  const list = await db.requisitionList.findUnique({ where: { id: listId } });
  if (!list || list.companyId !== ctx.companyId) return;

  const sku = String(formData.get("sku") ?? "").trim();
  const qty = Math.max(1, Number(String(formData.get("qty") ?? "1").trim()) || 1);
  if (!sku) return;

  // Capture the reference price the way the reorder endpoint will compute it —
  // B2B, in the company's own currency (/api/b2b/requisition-lists/reprice).
  // RequisitionListItem.unitPrice has no currency column and there is no FX
  // table in this repository, so a price captured in some other currency is a
  // number nobody can read back correctly.
  const currency = companyCurrencyForCountry(ctx.company.country);

  // Look the SKU up in the catalog to capture name + price; otherwise add as a
  // free-text line. The lookup is deliberately unfiltered: "no such SKU" and
  // "withdrawn from sale" are different answers, and a filtered read cannot
  // tell them apart — it would quietly file a withdrawn product as free text.
  const product = await db.product.findUnique({
    where: { sku },
    include: {
      prices: { where: { isActive: true, type: "B2B", currency }, orderBy: { minQty: "asc" }, take: 1 },
      seller: { select: { status: true, deletedAt: true } },
    },
  });

  // A requisition list is a purchasing document: its lines are copied straight
  // into a cart at reorder time. Denormalising a soft-deleted or withdrawn
  // product's name and price into one records a commitment the platform will
  // then refuse — the reprice endpoint rejects exactly this set, and
  // secure-checkout rejects it again. Refuse where the line is authored, and
  // say why, rather than saving a basket that can never be reordered.
  const unavailable =
    product &&
    (product.deletedAt !== null ||
      product.status !== "ACTIVE" ||
      !product.isB2BEnabled ||
      product.seller.deletedAt !== null ||
      product.seller.status !== "ACTIVE");
  if (unavailable) {
    // The outcome is carried back in the query string, as the governed
    // purchase-order actions do: this action is bound to a plain form and so
    // has no return channel, and dropping the line in silence would be
    // indistinguishable from having added it.
    // A CODE plus the one value it names, never a finished sentence. Both come
    // back off the query string, which anyone can write, and <ActionBanner>
    // will only render an outcome it recognises — a link that paints arbitrary
    // prose inside this product's own receipt is a phishing surface wearing the
    // platform's chrome. The sentence is chosen at render time, in the reader's
    // language, exactly as the governed purchase-order actions do it.
    redirect(`/b2b/lists?listError=listUnavailable&listArg=${encodeURIComponent(sku)}`);
  }

  await db.requisitionListItem.create({
    data: {
      listId,
      productId: product?.id ?? null,
      sku,
      nameEn: product?.nameEn ?? sku,
      qty,
      // Prisma.Decimal straight through — money never round-trips through a float.
      unitPrice: product?.prices[0]?.price ?? null,
    },
  });
  revalidatePath("/b2b/lists");
  // Success reports itself through the same channel, and must: leaving the
  // query string untouched would keep a previous attempt's error banner over a
  // line that did save — the same wrong answer in the other direction.
  redirect(
    product
      ? `/b2b/lists?listDone=listAdded&listArg=${encodeURIComponent(product.nameEn)}`
      : `/b2b/lists?listDone=listFreeText&listArg=${encodeURIComponent(sku)}`,
  );
}

export async function removeItem(itemId: string) {
  const ctx = await getB2BContext();
  if (!ctx) return;
  const item = await db.requisitionListItem.findUnique({ where: { id: itemId }, include: { list: true } });
  if (!item || item.list.companyId !== ctx.companyId) return;
  await db.requisitionListItem.delete({ where: { id: itemId } });
  revalidatePath("/b2b/lists");
}
