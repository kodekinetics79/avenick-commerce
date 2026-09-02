"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RECORD_ID } from "@avenick/utils";
import { fetchB2BJson } from "@/lib/b2b";

type Action = "approve" | "reject" | "order" | "cancel";

const DONE: Record<Action, string> = {
  approve: "Purchase order approved.",
  reject: "Purchase order rejected.",
  order: "Order placed.",
  cancel: "Purchase order cancelled.",
};

/**
 * Governed purchase-order state transitions.
 *
 * These four actions move company money. A previous version swallowed every
 * failure with `catch { return; }` and re-rendered the page unchanged, so an
 * approver clicking "Approve" on a six-figure commitment could not tell whether
 * it had happened — permission denied, already decided, price moved and stock
 * gone all looked identical to success.
 *
 * The outcome is now carried back in the query string and rendered as a banner.
 * Silence is not an acceptable answer for a financial transition.
 */
async function transition(id: string, action: Action, returnTo: string) {
  let failure = "";

  // A malformed id cannot come from the rendered page — every button binds an
  // id the server itself read from the database — so this branch means a forged
  // submission. Refuse before the value reaches the URL builder, and still land
  // the caller on a banner rather than a silent no-op.
  if (!RECORD_ID.test(id)) {
    redirect(
      `${returnTo}?poError=${encodeURIComponent(
        "That purchase order could not be identified. Reload the page and try again.",
      )}`,
    );
  }

  try {
    // Encoding is the containment; the shape check above is the guard. Keep
    // both — encodeURIComponent holds even if the id shape is ever widened.
    await fetchB2BJson(`/api/b2b/purchase-orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
  } catch (error) {
    // Surface the server's own reason where there is one — "already approved"
    // or "price changed, re-approval required" are actionable; a generic
    // failure message is not.
    failure =
      error instanceof Error && error.message.trim()
        ? error.message
        : "The request could not be completed. Please retry.";
  }

  revalidatePath("/b2b/purchase-orders");
  revalidatePath("/b2b/approvals");
  revalidatePath("/b2b");
  if (action === "order") revalidatePath("/b2b/billing");

  // redirect() throws by design, so it must sit outside the try block above.
  const param = failure
    ? `poError=${encodeURIComponent(failure)}`
    : `poDone=${encodeURIComponent(DONE[action])}`;
  redirect(`${returnTo}?${param}`);
}

export async function approvePO(id: string) {
  await transition(id, "approve", "/b2b/approvals");
}

export async function rejectPO(id: string) {
  await transition(id, "reject", "/b2b/approvals");
}

/** Place an approved line-based PO through governed checkout. */
export async function markOrdered(id: string) {
  await transition(id, "order", "/b2b/purchase-orders");
}

export async function cancelPO(id: string) {
  await transition(id, "cancel", "/b2b/purchase-orders");
}
