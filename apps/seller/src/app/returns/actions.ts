"use server";

import { revalidatePath } from "next/cache";
import { requireSellerPermission } from "@/lib/auth";
import { db, setReturnStatus as applyReturnStatus } from "@avenick/database";

const STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "IN_TRANSIT", "RECEIVED", "REFUNDED"] as const;

export async function setReturnStatus(id: string, status: (typeof STATUSES)[number]) {
  const { seller, userId } = await requireSellerPermission("returns.manage");
  if (!STATUSES.includes(status)) return;
  const r = await db.returnRequest.findUnique({ where: { id } });
  if (!r || r.sellerId !== seller.id) return;

  // Route through the validated, transactional workflow rather than a raw write:
  // it enforces the RETURN_TRANSITIONS state machine and creates the Refund row
  // when moving to REFUNDED. Actor attribution uses the authenticated staff/owner
  // user, never SellerProfile.userId (which always identifies the owner).
  try {
    await applyReturnStatus({ returnId: id, status, actorId: userId });
  } catch {
    return;
  }
  revalidatePath("/returns");
}
