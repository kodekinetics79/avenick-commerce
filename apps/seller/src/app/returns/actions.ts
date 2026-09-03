"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSellerPermission } from "@/lib/auth";
import { db, setReturnStatus as applyReturnStatus } from "@avenick/database";

const STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "IN_TRANSIT", "RECEIVED", "REFUNDED"] as const;

export async function setReturnStatus(id: string, status: (typeof STATUSES)[number]) {
  const { seller, userId } = await requireSellerPermission("returns.manage");
  // Refusals are reported, not swallowed. A seller pressing Approve on a return
  // they cannot act on previously saw the page re-render unchanged, which is
  // indistinguishable from success.
  if (!STATUSES.includes(status)) redirect(`/returns?returnError=${encodeURIComponent("Unsupported return status.")}`);
  const r = await db.returnRequest.findUnique({ where: { id } });
  if (!r || r.sellerId !== seller.id) {
    redirect(`/returns?returnError=${encodeURIComponent("That return is not available on your account.")}`);
  }

  // Route through the validated, transactional workflow rather than a raw write:
  // it enforces the RETURN_TRANSITIONS state machine and creates the Refund row
  // when moving to REFUNDED. Actor attribution uses the authenticated staff/owner
  // user, never SellerProfile.userId (which always identifies the owner).
  let failure = "";
  try {
    await applyReturnStatus({ returnId: id, status, actorId: userId });
  } catch (error) {
    // Surface the workflow's own reason — the RETURN_TRANSITIONS state machine
    // rejects illegal moves with a message worth showing.
    failure =
      error instanceof Error && error.message.trim()
        ? error.message
        : "The return could not be updated. Please retry.";
  }

  revalidatePath("/returns");
  // redirect() throws by design, so it sits outside the try above.
  redirect(
    failure
      ? `/returns?returnError=${encodeURIComponent(failure)}`
      : `/returns?returnDone=${encodeURIComponent(`Return ${status.toLowerCase()}.`)}`,
  );
}
