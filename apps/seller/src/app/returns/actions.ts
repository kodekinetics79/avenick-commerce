"use server";

import { revalidatePath } from "next/cache";
import { requireSellerSession } from "@/lib/auth";
import { db, setReturnStatus as applyReturnStatus } from "@avenick/database";

const STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "IN_TRANSIT", "RECEIVED", "REFUNDED"] as const;

export async function setReturnStatus(id: string, status: (typeof STATUSES)[number]) {
  const { seller } = await requireSellerSession();
  if (!STATUSES.includes(status)) return;
  const r = await db.returnRequest.findUnique({ where: { id } });
  if (!r || r.sellerId !== seller.id) return;

  // Route through the validated, transactional workflow rather than a raw write:
  // it enforces the RETURN_TRANSITIONS state machine and creates the Refund row
  // when moving to REFUNDED. A raw update here could jump illegal transitions
  // (e.g. REQUESTED → REFUNDED) and mark a refund with no Refund record. Illegal
  // transitions throw; we swallow so the page just re-renders unchanged rather
  // than showing an error screen to a self-serve tester.
  try {
    await applyReturnStatus({ returnId: id, status, actorId: seller.userId });
  } catch {
    return;
  }
  revalidatePath("/returns");
}
