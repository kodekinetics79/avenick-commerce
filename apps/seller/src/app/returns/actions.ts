"use server";

import { revalidatePath } from "next/cache";
import { requireSellerSession } from "@/lib/auth";
import { db } from "@avenick/database";

const STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "IN_TRANSIT", "RECEIVED", "REFUNDED"] as const;

export async function setReturnStatus(id: string, status: (typeof STATUSES)[number]) {
  const { seller } = await requireSellerSession();
  if (!STATUSES.includes(status)) return;
  const r = await db.returnRequest.findUnique({ where: { id } });
  if (!r || r.sellerId !== seller.id) return;
  await db.returnRequest.update({ where: { id }, data: { status } });
  revalidatePath("/returns");
}
