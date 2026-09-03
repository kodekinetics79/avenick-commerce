"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSellerPermission } from "@/lib/auth";
import { db, setReturnStatus as applyReturnStatus } from "@avenick/database";

const STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "IN_TRANSIT", "RECEIVED", "REFUNDED"] as const;

export async function setReturnStatus(id: string, status: (typeof STATUSES)[number]) {
  // The permission gate stays the first thing this action does. Nothing — not
  // even loading the message tree — runs ahead of it.
  const { seller, userId } = await requireSellerPermission("returns.manage");
  // The action reports its outcome through the query string, so the sentence is
  // resolved HERE, in the caller's own locale, from the same message tree the
  // page reads. next-intl's request config is cookie-based, so a Server Action
  // resolves the same locale the page that submitted it was rendered in.
  const t = await getTranslations("sellerOps");
  // Refusals are reported, not swallowed. A seller pressing Approve on a return
  // they cannot act on previously saw the page re-render unchanged, which is
  // indistinguishable from success.
  if (!STATUSES.includes(status)) {
    redirect(`/returns?returnError=${encodeURIComponent(t("returns.action.unsupportedStatus"))}`);
  }
  const r = await db.returnRequest.findUnique({ where: { id } });
  if (!r || r.sellerId !== seller.id) {
    redirect(`/returns?returnError=${encodeURIComponent(t("returns.action.notOnAccount"))}`);
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
    // rejects illegal moves with a message worth showing. That reason is written
    // by @avenick/database and is not in this app's message tree, so it is shown
    // verbatim rather than replaced by a vaguer translated sentence: a stated
    // refusal in English beats a softened one in Arabic. Only the fallback, when
    // the workflow gives no reason at all, is translated.
    failure =
      error instanceof Error && error.message.trim()
        ? error.message
        : t("returns.action.updateFailed");
  }

  revalidatePath("/returns");
  // redirect() throws by design, so it sits outside the try above.
  redirect(
    failure
      ? `/returns?returnError=${encodeURIComponent(failure)}`
      : `/returns?returnDone=${encodeURIComponent(
          // The same status vocabulary the pill on /returns reads, so the receipt
          // and the row can never name the state two different ways.
          t("returns.action.done", { status: t(`returns.status.${status}`).toLowerCase() }),
        )}`,
  );
}
