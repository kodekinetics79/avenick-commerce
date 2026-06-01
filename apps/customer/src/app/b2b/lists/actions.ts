"use server";

import { revalidatePath } from "next/cache";
import { db } from "@avenick/database";
import { getB2BContext, type B2BActionState } from "@/lib/b2b";

export async function createList(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  const ctx = await getB2BContext();
  if (!ctx) return { error: "Sign in with a company account to create lists." };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the list a name." };

  await db.requisitionList.create({ data: { companyId: ctx.companyId, ownerId: ctx.userId, name } });
  revalidatePath("/b2b/lists");
  return { ok: true, message: `List “${name}” created.` };
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

  // Look the SKU up in the catalog to capture name + price; otherwise add as a free-text line.
  const product = await db.product.findUnique({
    where: { sku },
    include: { prices: { where: { isActive: true }, orderBy: { minQty: "asc" }, take: 1 } },
  });

  await db.requisitionListItem.create({
    data: {
      listId,
      productId: product?.id ?? null,
      sku,
      nameEn: product?.nameEn ?? sku,
      qty,
      unitPrice: product?.prices[0] ? Number(product.prices[0].price) : null,
    },
  });
  revalidatePath("/b2b/lists");
}

export async function removeItem(itemId: string) {
  const ctx = await getB2BContext();
  if (!ctx) return;
  const item = await db.requisitionListItem.findUnique({ where: { id: itemId }, include: { list: true } });
  if (!item || item.list.companyId !== ctx.companyId) return;
  await db.requisitionListItem.delete({ where: { id: itemId } });
  revalidatePath("/b2b/lists");
}
